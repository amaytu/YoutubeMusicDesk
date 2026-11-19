//! Cor de destaque a partir da capa: baixa uma miniatura e escolhe o tom mais
//! "vivo" (saturado e não escuro). A UI clareia essa cor para ter contraste.
//! Feito no Rust para não depender de CORS dos servidores de imagem.

use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri::{Runtime, State, Webview};

use crate::{ISLAND_WINDOW, MAIN_WINDOW};

#[derive(Default)]
pub struct PaletteCache(Mutex<HashMap<String, Option<[u8; 3]>>>);

fn rgb_to_hsv(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let d = max - min;
    let h = if d == 0.0 {
        0.0
    } else if max == r {
        60.0 * (((g - b) / d).rem_euclid(6.0))
    } else if max == g {
        60.0 * ((b - r) / d + 2.0)
    } else {
        60.0 * ((r - g) / d + 4.0)
    };
    let s = if max == 0.0 { 0.0 } else { d / max };
    (h, s, max)
}

/// Escolhe a cor dominante entre os pixels vivos (histograma de matiz ponderado).
pub fn dominant(pixels: &[[u8; 3]]) -> Option<[u8; 3]> {
    const BINS: usize = 36;
    let mut weight = [0f32; BINS];
    let mut sum = [[0f32; 3]; BINS];
    let (mut avg, mut n) = ([0f32; 3], 0f32);
    for p in pixels {
        let (r, g, b) = (
            p[0] as f32 / 255.0,
            p[1] as f32 / 255.0,
            p[2] as f32 / 255.0,
        );
        avg[0] += r;
        avg[1] += g;
        avg[2] += b;
        n += 1.0;
        let (h, s, v) = rgb_to_hsv(r, g, b);
        if v < 0.18 || s < 0.15 {
            continue; // quase preto, quase branco ou cinza
        }
        let w = s * v * v;
        let bin = ((h / 360.0) * BINS as f32) as usize % BINS;
        weight[bin] += w;
        sum[bin][0] += r * w;
        sum[bin][1] += g * w;
        sum[bin][2] += b * w;
    }
    if n == 0.0 {
        return None;
    }
    // soma o bin com os vizinhos para não dividir um tom entre dois bins
    let best = (0..BINS)
        .max_by(|&a, &b| {
            let wa = weight[a] + 0.5 * (weight[(a + 1) % BINS] + weight[(a + BINS - 1) % BINS]);
            let wb = weight[b] + 0.5 * (weight[(b + 1) % BINS] + weight[(b + BINS - 1) % BINS]);
            wa.total_cmp(&wb)
        })
        .unwrap_or(0);
    let to_u8 = |x: f32| (x.clamp(0.0, 1.0) * 255.0).round() as u8;
    if weight[best] > n * 0.01 {
        let w = weight[best];
        Some([
            to_u8(sum[best][0] / w),
            to_u8(sum[best][1] / w),
            to_u8(sum[best][2] / w),
        ])
    } else {
        // capa sem cor (P&B): devolve a média; a UI deixa quase branco
        Some([to_u8(avg[0] / n), to_u8(avg[1] / n), to_u8(avg[2] / n)])
    }
}

fn fetch(url: &str) -> Option<[u8; 3]> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(8)))
        .build()
        .into();
    let bytes = agent
        .get(url)
        .header("Accept", "image/jpeg,image/png,image/webp")
        .call()
        .ok()?
        .body_mut()
        .with_config()
        .limit(5 * 1024 * 1024)
        .read_to_vec()
        .ok()?;
    let img = image::load_from_memory(&bytes).ok()?;
    let small = img.thumbnail(32, 32).to_rgb8();
    let pixels: Vec<[u8; 3]> = small.pixels().map(|p| p.0).collect();
    dominant(&pixels)
}

#[tauri::command]
pub async fn cover_color<R: Runtime>(
    webview: Webview<R>,
    cache: State<'_, PaletteCache>,
    url: String,
) -> Result<Option<[u8; 3]>, String> {
    if ![MAIN_WINDOW, ISLAND_WINDOW].contains(&webview.label()) {
        return Err("não permitido".into());
    }
    if !url.starts_with("https://") {
        return Ok(None);
    }
    if let Some(hit) = cache.0.lock().unwrap().get(&url) {
        return Ok(*hit);
    }
    let u = url.clone();
    let color = tauri::async_runtime::spawn_blocking(move || fetch(&u))
        .await
        .map_err(|e| e.to_string())?;
    let mut c = cache.0.lock().unwrap();
    if c.len() > 300 {
        c.clear();
    }
    c.insert(url, color);
    Ok(color)
}

#[cfg(test)]
mod tests {
    use super::dominant;

    #[test]
    fn picks_vivid_color_over_dark_background() {
        // 80% quase preto + 20% azul vivo -> azul
        let mut px = vec![[10u8, 10, 12]; 80];
        px.extend(vec![[30u8, 90, 230]; 20]);
        let c = dominant(&px).unwrap();
        assert!(c[2] > 180 && c[0] < 80, "{c:?}");
    }

    #[test]
    fn grayscale_falls_back_to_average() {
        let px = vec![[120u8, 120, 120]; 50];
        assert_eq!(dominant(&px), Some([120, 120, 120]));
    }
}
