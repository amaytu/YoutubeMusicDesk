//! Letras sincronizadas (LRC) via LRCLIB (https://lrclib.net), gratuita e sem chave.
//! A busca roda no Rust (sem depender de CORS) e o resultado fica em cache na memória.
//! Fluxo: correspondência exata (título, artista, álbum, duração) e, se falhar,
//! pesquisa por título + artista. Nos dois casos a duração da letra precisa
//! bater com a da faixa (±2 s); senão é outra versão (ao vivo, remix...) e a
//! letra sairia dessincronizada.

use serde::Deserialize;
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri::{Runtime, State, Webview};

use crate::{ISLAND_WINDOW, MAIN_WINDOW};

const BASE: &str = "https://lrclib.net/api";
/// Diferença máxima de duração entre a faixa e a letra.
const MAX_DIFF: f64 = 2.0;
const UA: &str = concat!(
    "YouTubeMusicDesk/",
    env!("CARGO_PKG_VERSION"),
    " (https://github.com/amaytu/YoutubeMusicDesk)"
);

#[derive(Default)]
pub struct LyricsCache(Mutex<HashMap<String, Option<String>>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    synced_lyrics: Option<String>,
    duration: Option<f64>,
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(8)))
        .user_agent(UA)
        .build()
        .into()
}

fn fetch(title: &str, artist: &str, album: Option<&str>, duration: Option<f64>) -> Option<String> {
    let agent = agent();
    let synced = |e: &Entry| e.synced_lyrics.clone().filter(|s| !s.trim().is_empty());
    let same_length = |e: &Entry| match (duration, e.duration) {
        (Some(d), Some(x)) if d > 0.0 => (d - x).abs() <= MAX_DIFF,
        _ => true,
    };

    // 1) correspondência exata
    let mut req = agent
        .get(format!("{BASE}/get"))
        .query("track_name", title)
        .query("artist_name", artist);
    if let Some(a) = album.filter(|a| !a.is_empty()) {
        req = req.query("album_name", a);
    }
    if let Some(d) = duration.filter(|d| *d > 0.0) {
        req = req.query("duration", d.round().to_string());
    }
    if let Ok(mut res) = req.call() {
        if let Ok(e) = res
            .body_mut()
            .read_to_string()
            .map(|b| serde_json::from_str::<Entry>(&b))
        {
            if let Some(s) = e.ok().as_ref().filter(|e| same_length(e)).and_then(synced) {
                return Some(s);
            }
        }
    }

    // 2) pesquisa com tolerância de duração
    let mut res = agent
        .get(format!("{BASE}/search"))
        .query("track_name", title)
        .query("artist_name", artist)
        .call()
        .ok()?;
    let list: Vec<Entry> = serde_json::from_str(&res.body_mut().read_to_string().ok()?).ok()?;
    // Entre as compatíveis, a de duração mais próxima.
    let mut ok: Vec<&Entry> = list
        .iter()
        .filter(|e| same_length(e) && synced(e).is_some())
        .collect();
    if let Some(d) = duration.filter(|d| *d > 0.0) {
        ok.sort_by(|a, b| {
            let da = (a.duration.unwrap_or(f64::MAX) - d).abs();
            let db = (b.duration.unwrap_or(f64::MAX) - d).abs();
            da.total_cmp(&db)
        });
    }
    ok.first().and_then(|e| synced(e))
}

/// "A, B & C" -> "A". Usado como 2ª tentativa (o LRCLIB costuma indexar pelo principal).
fn main_artist(artist: &str) -> &str {
    artist.split([',', '&']).next().unwrap_or(artist).trim()
}

#[tauri::command]
pub async fn synced_lyrics<R: Runtime>(
    webview: Webview<R>,
    cache: State<'_, LyricsCache>,
    title: String,
    artist: String,
    album: Option<String>,
    duration: Option<f64>,
) -> Result<Option<String>, String> {
    if ![MAIN_WINDOW, ISLAND_WINDOW].contains(&webview.label()) {
        return Err("não permitido".into());
    }
    let key = format!("{title}\u{1}{artist}");
    if let Some(hit) = cache.0.lock().unwrap().get(&key) {
        return Ok(hit.clone());
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        fetch(&title, &artist, album.as_deref(), duration).or_else(|| {
            let main = main_artist(&artist);
            (main != artist)
                .then(|| fetch(&title, main, album.as_deref(), duration))
                .flatten()
        })
    })
    .await
    .map_err(|e| e.to_string())?;
    cache.0.lock().unwrap().insert(key, result.clone());
    Ok(result)
}

#[cfg(test)]
mod tests {
    #[test]
    fn main_artist() {
        assert_eq!(super::main_artist("The Weeknd, Daft Punk"), "The Weeknd");
        assert_eq!(super::main_artist("Simon & Garfunkel"), "Simon");
        assert_eq!(super::main_artist("Adele"), "Adele");
    }
}
