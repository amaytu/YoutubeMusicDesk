//! Criação da janela principal (WebView2 apontando para music.youtube.com).

use tauri::{
    webview::NewWindowResponse, AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;

use crate::{power, settings, settings::Settings, tray, MAIN_WINDOW};

const HOME: &str = "https://music.youtube.com/";

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

fn browser_args(s: &Settings) -> String {
    let mut features = DISABLED_FEATURES.to_vec();
    if s.media_keys {
        // Evita play/pause duplo: o app trata as teclas de mídia, não o Chromium.
        features.push("HardwareMediaKeyHandling");
    }
    let mut args = format!(
        "--disable-features={} --process-per-site --disable-background-networking",
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

pub fn create<R: Runtime>(app: &AppHandle<R>, s: &Settings, visible: bool) -> tauri::Result<()> {
    let nav_app = app.clone();
    let popup_app = app.clone();

    let mut builder = WebviewWindowBuilder::new(
        app,
        MAIN_WINDOW,
        WebviewUrl::External(HOME.parse().unwrap()),
    )
    .title("YouTube Music Desk")
    .inner_size(1200.0, 800.0)
    .min_inner_size(420.0, 320.0)
    .visible(false) // mostrada depois que o window-state restaurar posição/tamanho
    .background_color(tauri::window::Color(3, 3, 3, 255))
    .initialization_script(include_str!("inject.js"))
    .on_navigation(move |url| {
        let ok = is_allowed(url);
        if !ok {
            let _ = nav_app.opener().open_url(url.as_str(), None::<&str>);
        }
        ok
    })
    .on_new_window(move |url, _features| {
        // Links "abrir em nova aba" vão para o navegador padrão.
        let _ = popup_app.opener().open_url(url.as_str(), None::<&str>);
        NewWindowResponse::Deny
    })
    .on_document_title_changed(|w, title| tray::set_track(w.app_handle(), &title));

    #[cfg(windows)]
    {
        builder = builder.additional_browser_args(&browser_args(s));
    }
    #[cfg(not(windows))]
    let _ = browser_args(s);

    if let Some(ua) = s.user_agent.as_deref().filter(|u| !u.trim().is_empty()) {
        builder = builder.user_agent(ua);
    }

    let window = builder.build()?;
    if visible {
        show_window(&window);
    } else if s.economy_when_hidden {
        power::set_background(&window, true);
    }
    Ok(())
}

/// Domínios que podem abrir dentro do app (YouTube + login do Google).
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
    power::set_background(w, false);
}

pub fn show<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        show_window(&w);
    }
}

pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.hide();
        if settings::get(app).economy_when_hidden {
            power::set_background(&w, true);
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
    if !settings::get(w.app_handle()).economy_when_hidden {
        return;
    }
    if w.is_minimized().unwrap_or(false) {
        power::set_background(w, true);
    } else if w.is_visible().unwrap_or(false) {
        power::set_background(w, false);
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
