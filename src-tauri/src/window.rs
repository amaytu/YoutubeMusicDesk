//! Janelas:
//! - `main`: a interface própria (Svelte), sem moldura do Windows.
//! - `player`: music.youtube.com oculto; toca o áudio e fornece os dados.
//!   Só aparece durante o login do Google.

use tauri::{
    webview::{NewWindowResponse, PageLoadEvent},
    AppHandle, LogicalSize, Manager, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;

use crate::{
    bridge::Bridge, island, login, power, settings, settings::Settings, MAIN_WINDOW, PLAYER_WINDOW,
};

pub const HOME: &str = "https://music.youtube.com/";

/// Recursos do WebView2 que não servem para um player de música.
/// Os três primeiros são os padrões do wry (passar args substitui os padrões).
const DISABLED_FEATURES: &[&str] = &[
    "msWebOOUI",
    "msPdfOOUI",
    "msSmartScreenProtection",
    "Translate",
    "msEdgeTranslate",
    "MediaRouter",
    "OptimizationHints",
    "AutofillServerCommunication",
];

/// As duas janelas compartilham o mesmo processo do navegador, então usam
/// exatamente os mesmos argumentos.
pub fn browser_args(s: &Settings) -> String {
    let mut features = DISABLED_FEATURES.to_vec();
    if s.media_keys {
        // Evita play/pause duplo: o app trata as teclas de mídia, não o Chromium.
        features.push("HardwareMediaKeyHandling");
    }
    let mut args = format!(
        "--disable-features={} --process-per-site --disable-background-networking \
         --autoplay-policy=no-user-gesture-required",
        features.join(",")
    );
    if let Some(extra) = s
        .extra_browser_args
        .as_deref()
        .filter(|e| !e.trim().is_empty())
    {
        args.push(' ');
        args.push_str(extra.trim());
    }
    args
}

fn open_external<R: Runtime>(app: &AppHandle<R>, url: &Url) {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

/// Interface principal.
pub fn create_main<R: Runtime>(
    app: &AppHandle<R>,
    s: &Settings,
    visible: bool,
) -> tauri::Result<()> {
    let nav_app = app.clone();
    let popup_app = app.clone();
    #[allow(unused_mut)]
    let mut builder =
        WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App("index.html".into()))
            .title("YouTube Music Desk")
            .inner_size(1280.0, 820.0)
            .min_inner_size(900.0, 600.0)
            .decorations(false)
            .visible(false) // mostrada depois que o window-state restaurar posição/tamanho
            .background_color(tauri::window::Color(14, 14, 18, 255))
            .on_navigation(move |url| {
                // Só a própria UI navega dentro da janela; links vão para o navegador.
                let local = matches!(url.scheme(), "tauri" | "asset")
                    || matches!(url.host_str(), Some("tauri.localhost") | Some("localhost"));
                if !local {
                    open_external(&nav_app, url);
                }
                local
            })
            .on_new_window(move |url, _| {
                open_external(&popup_app, &url);
                NewWindowResponse::Deny
            });
    #[cfg(windows)]
    {
        builder = builder.additional_browser_args(&browser_args(s));
    }
    let window = builder.build()?;
    if visible {
        show_window(&window);
    } else {
        island::set_background(app, true);
        if s.economy_when_hidden {
            power::set_background(app, true);
        }
    }
    Ok(())
}

/// YouTube Music oculto (motor de reprodução e dados).
pub fn create_player<R: Runtime>(app: &AppHandle<R>, s: &Settings) -> tauri::Result<()> {
    let nav_app = app.clone();
    let popup_app = app.clone();
    let mut builder = WebviewWindowBuilder::new(
        app,
        PLAYER_WINDOW,
        WebviewUrl::External(HOME.parse().unwrap()),
    )
    .title("Entrar no YouTube Music")
    .inner_size(520.0, 720.0)
    .center()
    .visible(false)
    .skip_taskbar(true)
    .background_color(tauri::window::Color(3, 3, 3, 255))
    .initialization_script(include_str!("bridge.js"))
    .on_navigation(move |url| {
        if !is_allowed(url) {
            open_external(&nav_app, url);
            return false;
        }
        login::on_navigation(&nav_app, url)
    })
    .on_new_window(move |url, _| {
        open_external(&popup_app, &url);
        NewWindowResponse::Deny
    })
    .on_page_load(|w, payload| {
        if payload.event() == PageLoadEvent::Started {
            w.app_handle().state::<Bridge>().on_reload();
        }
    });
    #[cfg(windows)]
    {
        builder = builder.additional_browser_args(&browser_args(s));
    }
    if let Some(ua) = s.user_agent.as_deref().filter(|u| !u.trim().is_empty()) {
        builder = builder.user_agent(ua);
    }
    #[cfg(not(windows))]
    let _ = browser_args(s);
    builder.build()?;
    Ok(())
}

/// Mostra a janela do player para o login do Google.
pub fn show_player_for_login<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    let p = app.get_webview_window(PLAYER_WINDOW)?;
    let _ = p.set_size(LogicalSize::new(520.0, 720.0));
    let _ = p.center();
    let _ = p.set_skip_taskbar(false);
    let _ = p.show();
    let _ = p.set_focus();
    Some(p)
}

/// Domínios que podem abrir dentro do player (YouTube + login do Google).
fn is_allowed(url: &Url) -> bool {
    match url.scheme() {
        "https" => {}
        "about" | "blob" | "data" => return true,
        _ => return false,
    }
    let host = url.host_str().unwrap_or_default();
    let under = |domain: &str| host == domain || host.ends_with(&format!(".{domain}"));
    under("youtube.com") || under("google.com") || is_google_cctld(host)
}

/// accounts.google.com.br, www.google.de etc. (usados no fluxo de login).
fn is_google_cctld(host: &str) -> bool {
    let h = host
        .strip_prefix("accounts.")
        .or_else(|| host.strip_prefix("www."))
        .unwrap_or(host);
    let Some(tld) = h.strip_prefix("google.") else {
        return false;
    };
    let labels: Vec<&str> = tld.split('.').collect();
    (1..=2).contains(&labels.len())
        && labels
            .iter()
            .all(|l| (2..=3).contains(&l.len()) && l.chars().all(|c| c.is_ascii_lowercase()))
}

fn show_window<R: Runtime>(w: &WebviewWindow<R>) {
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
    power::set_background(w.app_handle(), false);
    island::set_background(w.app_handle(), false);
}

pub fn show<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        show_window(&w);
    }
}

pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.hide();
        island::set_background(app, true);
        if settings::get(app).economy_when_hidden {
            power::set_background(app, true);
        }
    }
}

pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    let Some(w) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    let visible = w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false);
    if visible {
        hide(app);
    } else {
        show_window(&w);
    }
}

/// Chamado em `Resized`: minimizar também ativa o modo economia.
pub fn on_resized<R: Runtime>(w: &WebviewWindow<R>) {
    let app = w.app_handle();
    let economy = settings::get(app).economy_when_hidden;
    if w.is_minimized().unwrap_or(false) {
        island::set_background(app, true);
        if economy {
            power::set_background(app, true);
        }
    } else if w.is_visible().unwrap_or(false) {
        island::set_background(app, false);
        if economy {
            power::set_background(app, false);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(u: &str) -> bool {
        is_allowed(&u.parse().unwrap())
    }

    #[test]
    fn allowlist() {
        assert!(ok("https://music.youtube.com/watch?v=x"));
        assert!(ok("https://accounts.google.com/ServiceLogin"));
        assert!(ok("https://accounts.google.com.br/accounts/SetSID"));
        assert!(ok("https://consent.youtube.com/"));
        assert!(!ok("https://google.evil.com/"));
        assert!(!ok("https://example.com/"));
        assert!(!ok("http://music.youtube.com/"));
        assert!(!ok("mailto:a@b.com"));
    }
}
