//! Tradução das letras (linha a linha), feita no Rust para não depender de CORS.
//!
//! - Padrão: endpoint público do Google Tradutor (não oficial, sem chave).
//! - Com `deepl_api_key` no settings.json: API oficial do DeepL (plano Free:
//!   500 mil caracteres/mês).
//!
//! O resultado fica em cache na memória por letra + idioma.

use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::hash_map::DefaultHasher,
    collections::HashMap,
    hash::{Hash, Hasher},
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Runtime, State, Webview};

use crate::{settings, ISLAND_WINDOW, MAIN_WINDOW};

/// Limite de caracteres por requisição (folga para o encoding).
const CHUNK: usize = 3500;

#[derive(Default)]
pub struct TranslateCache(Mutex<HashMap<u64, Translation>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Translation {
    /// Mesma quantidade e ordem das linhas recebidas.
    lines: Vec<String>,
    /// Idioma detectado da letra original (ex.: "en").
    source: String,
    provider: &'static str,
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(12)))
        .build()
        .into()
}

/// Agrupa linhas em blocos de até CHUNK caracteres.
fn chunks(lines: &[String]) -> Vec<Vec<String>> {
    let mut out: Vec<Vec<String>> = vec![];
    let mut size = 0;
    for l in lines {
        if out.is_empty() || size + l.len() + 1 > CHUNK {
            out.push(vec![]);
            size = 0;
        }
        size += l.len() + 1;
        out.last_mut().unwrap().push(l.clone());
    }
    out
}

// ------------------------------------------------------------------ Google

fn google_text(agent: &ureq::Agent, text: &str, target: &str) -> Result<(String, String), String> {
    let url = format!(
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target}&dt=t"
    );
    let body = agent
        .post(&url)
        .send_form([("q", text)])
        .map_err(|e| e.to_string())?
        .body_mut()
        .read_to_string()
        .map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let translated: String = v[0]
        .as_array()
        .map(|segs| segs.iter().filter_map(|s| s[0].as_str()).collect())
        .unwrap_or_default();
    let source = v[2].as_str().unwrap_or("").to_string();
    Ok((translated, source))
}

fn google(lines: &[String], target: &str) -> Result<(Vec<String>, String), String> {
    let agent = agent();
    let mut out = Vec::with_capacity(lines.len());
    let mut source = String::new();
    for chunk in chunks(lines) {
        let (text, src) = google_text(&agent, &chunk.join("\n"), target)?;
        if source.is_empty() {
            source = src;
        }
        let parts: Vec<String> = text.split('\n').map(|s| s.trim().to_string()).collect();
        if parts.len() == chunk.len() {
            out.extend(parts);
        } else {
            // O tradutor juntou/quebrou linhas: traduz uma a uma para manter o alinhamento.
            for l in &chunk {
                out.push(google_text(&agent, l, target)?.0.trim().to_string());
            }
        }
    }
    Ok((out, source))
}

// ------------------------------------------------------------------ DeepL

fn deepl(lines: &[String], target: &str, key: &str) -> Result<(Vec<String>, String), String> {
    let host = if key.ends_with(":fx") {
        "api-free.deepl.com"
    } else {
        "api.deepl.com"
    };
    let target_lang = match target {
        "pt" => "PT-BR",
        t => t,
    }
    .to_uppercase();
    let agent = agent();
    let mut out = Vec::with_capacity(lines.len());
    let mut source = String::new();
    for chunk in chunks(lines) {
        let body = agent
            .post(format!("https://{host}/v2/translate"))
            .header("Authorization", format!("DeepL-Auth-Key {key}"))
            .content_type("application/json")
            .send(json!({ "text": chunk, "target_lang": target_lang }).to_string())
            .map_err(|e| format!("DeepL: {e}"))?
            .body_mut()
            .read_to_string()
            .map_err(|e| e.to_string())?;
        let v: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        let items = v["translations"].as_array().cloned().unwrap_or_default();
        if source.is_empty() {
            source = items
                .first()
                .and_then(|t| t["detected_source_language"].as_str())
                .unwrap_or("")
                .to_lowercase();
        }
        out.extend(
            items
                .iter()
                .map(|t| t["text"].as_str().unwrap_or("").to_string()),
        );
    }
    Ok((out, source))
}

// ------------------------------------------------------------------ comando

/// Linhas sem texto para traduzir (pausas instrumentais etc.) passam direto.
fn translatable(l: &str) -> bool {
    l.chars().any(char::is_alphabetic)
}

#[tauri::command]
pub async fn translate_lines<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    cache: State<'_, TranslateCache>,
    lines: Vec<String>,
    target: String,
) -> Result<Translation, String> {
    if ![MAIN_WINDOW, ISLAND_WINDOW].contains(&webview.label()) {
        return Err("não permitido".into());
    }
    let target = if target.is_empty() {
        "pt".to_string()
    } else {
        target.to_lowercase()
    };
    let mut h = DefaultHasher::new();
    (&lines, &target).hash(&mut h);
    let key = h.finish();
    if let Some(hit) = cache.0.lock().unwrap().get(&key) {
        return Ok(hit.clone());
    }

    let idx: Vec<usize> = (0..lines.len())
        .filter(|&i| translatable(&lines[i]))
        .collect();
    let todo: Vec<String> = idx.iter().map(|&i| lines[i].clone()).collect();
    let deepl_key = settings::get(&app)
        .deepl_api_key
        .filter(|k| !k.trim().is_empty());

    let (done, source, provider) = tauri::async_runtime::spawn_blocking(move || {
        if todo.is_empty() {
            return Ok((vec![], String::new(), "none"));
        }
        match deepl_key {
            Some(k) => deepl(&todo, &target, k.trim()).map(|(l, s)| (l, s, "deepl")),
            None => google(&todo, &target).map(|(l, s)| (l, s, "google")),
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut out = lines.clone();
    for (n, &i) in idx.iter().enumerate() {
        if let Some(t) = done.get(n).filter(|t| !t.is_empty()) {
            out[i] = t.clone();
        }
    }
    let result = Translation {
        lines: out,
        source,
        provider,
    };
    cache.0.lock().unwrap().insert(key, result.clone());
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunking_keeps_order_and_limits() {
        let lines: Vec<String> = (0..500)
            .map(|i| format!("linha número {i} da letra"))
            .collect();
        let cs = chunks(&lines);
        assert!(cs.len() > 1);
        assert!(cs
            .iter()
            .all(|c| c.iter().map(|l| l.len() + 1).sum::<usize>() <= CHUNK));
        assert_eq!(cs.concat(), lines);
    }

    #[test]
    fn skips_non_text_lines() {
        assert!(!translatable("♪"));
        assert!(!translatable("..."));
        assert!(translatable("I'm on my way"));
    }
}
