//! Atualização automática pelas releases do GitHub.
//!
//! Compara a versão do app com a última release; se houver uma nova, a UI mostra
//! o aviso. Ao confirmar, baixa o instalador (.exe) para a pasta temporária,
//! roda em modo passivo (`/P /R /UPDATE`: só a barra de progresso, reabre o app
//! no fim) e fecha o app para o instalador poder substituir os arquivos.

use serde::Serialize;
use std::{io::Read, time::Duration};
use tauri::{AppHandle, Emitter, Runtime, Webview};

use crate::MAIN_WINDOW;

const LATEST: &str = "https://api.github.com/repos/amaytu/YoutubeMusicDesk/releases/latest";
const UA: &str = concat!("YouTubeMusicDesk/", env!("CARGO_PKG_VERSION"));

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Update {
    pub version: String,
    pub notes: String,
    pub url: String,
    pub size: u64,
}

/// "v1.2.3" / "1.2.3-beta" -> (1, 2, 3)
fn parse(v: &str) -> Option<(u64, u64, u64)> {
    let core = v.trim().trim_start_matches('v').split(['-', '+']).next()?;
    let mut it = core.split('.').map(|p| p.parse::<u64>().ok());
    Some((it.next()??, it.next().flatten().unwrap_or(0), it.next().flatten().unwrap_or(0)))
}

fn newer(latest: &str, current: &str) -> bool {
    matches!((parse(latest), parse(current)), (Some(a), Some(b)) if a > b)
}

fn agent(timeout: u64) -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(timeout)))
        .user_agent(UA)
        .build()
        .into()
}

fn check(current: &str) -> Result<Option<Update>, String> {
    let text = agent(10)
        .get(LATEST)
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("Não foi possível verificar atualizações: {e}"))?
        .body_mut()
        .read_to_string()
        .map_err(|e| e.to_string())?;
    let body: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(pick(&body, current))
}

/// Lê a resposta da API do GitHub: a release é nova e tem instalador .exe?
fn pick(body: &serde_json::Value, current: &str) -> Option<Update> {
    let tag = body["tag_name"].as_str().unwrap_or_default();
    if !newer(tag, current) {
        return None;
    }
    let asset = body["assets"].as_array().and_then(|a| {
        a.iter()
            .find(|x| x["name"].as_str().is_some_and(|n| n.ends_with("-setup.exe")))
    });
    let asset = asset?;
    Some(Update {
        version: tag.trim_start_matches('v').to_string(),
        notes: body["body"].as_str().unwrap_or_default().to_string(),
        url: asset["browser_download_url"].as_str().unwrap_or_default().to_string(),
        size: asset["size"].as_u64().unwrap_or(0),
    })
}

fn allowed_url(url: &str) -> bool {
    url.starts_with("https://github.com/amaytu/YoutubeMusicDesk/releases/download/")
}

#[tauri::command]
pub async fn check_update<R: Runtime>(app: AppHandle<R>, webview: Webview<R>) -> Result<Option<Update>, String> {
    if webview.label() != MAIN_WINDOW {
        return Err("não permitido".into());
    }
    let current = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || check(&current))
        .await
        .map_err(|e| e.to_string())?
}

/// Baixa e instala. Emite "update-progress" (0..1) para a UI durante o download.
#[tauri::command]
pub async fn install_update<R: Runtime>(app: AppHandle<R>, webview: Webview<R>, url: String) -> Result<(), String> {
    if webview.label() != MAIN_WINDOW || !allowed_url(&url) {
        return Err("não permitido".into());
    }
    let app2 = app.clone();
    let path = tauri::async_runtime::spawn_blocking(move || download(&app2, &url))
        .await
        .map_err(|e| e.to_string())??;
    run_installer(&path)?;
    // Sai para o instalador poder trocar os arquivos (ele reabre o app no fim).
    app.exit(0);
    Ok(())
}

fn download<R: Runtime>(app: &AppHandle<R>, url: &str) -> Result<std::path::PathBuf, String> {
    let mut resp = agent(600)
        .get(url)
        .call()
        .map_err(|e| format!("Falha ao baixar a atualização: {e}"))?;
    let total = resp
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);
    let mut reader = resp.body_mut().with_config().limit(400 * 1024 * 1024).reader();
    let mut data = Vec::with_capacity(total as usize);
    let mut buf = [0u8; 64 * 1024];
    let mut last = 0.0f64;
    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("Falha ao baixar a atualização: {e}"))?;
        if n == 0 {
            break;
        }
        data.extend_from_slice(&buf[..n]);
        if total > 0 {
            let p = data.len() as f64 / total as f64;
            if p - last >= 0.02 {
                last = p;
                let _ = app.emit_to(MAIN_WINDOW, "update-progress", p);
            }
        }
    }
    // Um instalador do Windows começa com "MZ"; evita rodar uma página de erro.
    if data.len() < 1024 * 1024 || !data.starts_with(b"MZ") {
        return Err("O arquivo baixado não parece um instalador válido".into());
    }
    let path = std::env::temp_dir().join("YouTubeMusicDesk-update-setup.exe");
    std::fs::write(&path, &data).map_err(|e| format!("Não foi possível salvar a atualização: {e}"))?;
    let _ = app.emit_to(MAIN_WINDOW, "update-progress", 1.0);
    Ok(path)
}

fn run_installer(path: &std::path::Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new(path)
            .args(["/P", "/R", "/UPDATE"])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Não foi possível iniciar o instalador: {e}"))
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("Atualização automática só no Windows".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions() {
        assert!(newer("v1.0.0", "0.7.1"));
        assert!(newer("v1.0.1", "1.0.0"));
        assert!(newer("1.10.0", "1.9.9"));
        assert!(!newer("v1.0.0", "1.0.0"));
        assert!(!newer("v0.9.0", "1.0.0"));
        assert!(!newer("lixo", "1.0.0"));
        assert!(allowed_url("https://github.com/amaytu/YoutubeMusicDesk/releases/download/v1.0.0/a-setup.exe"));
        assert!(!allowed_url("https://evil.com/a.exe"));
    }

    #[test]
    fn github_response() {
        let body: serde_json::Value = serde_json::from_str(include_str!("../tests/release.json")).unwrap();
        let u = pick(&body, "0.6.0").expect("deveria achar atualização");
        assert!(allowed_url(&u.url), "{}", u.url);
        assert!(u.size > 1_000_000);
        assert!(pick(&body, "99.0.0").is_none());
    }
}
