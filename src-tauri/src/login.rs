//! Login com o Google em poucos cliques.
//!
//! O Google recusa login em "webviews embutidas" (inclui WebView2) e mostra
//! "Este navegador ou app pode não ser seguro". Para contornar sem atrapalhar o
//! player, o app troca o user agent **só durante o fluxo de login**: ao sair de
//! music.youtube.com (rumo a accounts.google.com) usa um UA de navegador comum;
//! ao voltar para music.youtube.com restaura o UA original do WebView2.
//!
//! A troca é feita cancelando a navegação e refazendo-a já com o novo UA, porque
//! o WebView2 só aplica `SetUserAgent` a partir da próxima navegação.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, Runtime, Url};

use crate::{settings, MAIN_WINDOW};

/// Mesmo destino do botão "Fazer login" do YouTube Music.
pub const LOGIN_URL: &str = "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26next%3Dhttps%253A%252F%252Fmusic.youtube.com%252F";

/// UA usado apenas nas páginas de login (configurável em settings.json).
pub const DEFAULT_LOGIN_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0";

static LOGIN_UA_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Tudo que não é o player em si faz parte do fluxo de login/redirecionamento.
fn is_login_flow(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str() != Some("music.youtube.com")
}

/// Chamado em `on_navigation` para URLs já permitidas.
/// Retorna `false` quando cancela a navegação para refazê-la com outro UA.
pub fn on_navigation<R: Runtime>(app: &AppHandle<R>, url: &Url) -> bool {
    if !cfg!(windows) {
        return true;
    }
    let s = settings::get(app);
    if !s.login_ua_switch || !matches!(url.scheme(), "https") {
        return true;
    }
    let want = is_login_flow(url);
    if LOGIN_UA_ACTIVE.swap(want, Ordering::SeqCst) == want {
        return true;
    }
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return true;
    };
    let ua = want.then(|| {
        s.login_user_agent
            .filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_LOGIN_UA.to_string())
    });
    platform::set_user_agent(&window, ua);
    // Fora do handler de navegação para não reentrar no WebView2.
    let url = url.clone();
    std::thread::spawn(move || {
        let _ = window.navigate(url);
    });
    false
}

/// Abre direto a tela de login do Google (ou o seletor de contas, se já houver uma).
pub fn start<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        crate::window::show(app);
        let _ = w.navigate(LOGIN_URL.parse().unwrap());
    }
}

/// Sai da conta apagando cookies e dados do WebView2, e volta ao player.
pub fn sign_out<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.clear_all_browsing_data();
        let _ = w.navigate(crate::window::HOME.parse().unwrap());
    }
}

#[cfg(windows)]
mod platform {
    use std::sync::OnceLock;
    use tauri::{Runtime, WebviewWindow};
    use webview2_com::{CoTaskMemPWSTR, Microsoft::Web::WebView2::Win32::ICoreWebView2Settings2};
    use windows::core::{Interface, PWSTR};

    static ORIGINAL_UA: OnceLock<String> = OnceLock::new();

    /// `None` restaura o UA original (padrão do WebView2 ou o `user_agent` configurado).
    pub fn set_user_agent<R: Runtime>(window: &WebviewWindow<R>, ua: Option<String>) {
        let _ = window.with_webview(move |wv| unsafe {
            let Ok(core) = wv.controller().CoreWebView2() else {
                return;
            };
            let Ok(settings) = core.Settings() else {
                return;
            };
            let Ok(s2) = settings.cast::<ICoreWebView2Settings2>() else {
                return;
            };
            let original = ORIGINAL_UA.get_or_init(|| {
                let mut p = PWSTR::null();
                match s2.UserAgent(&mut p) {
                    Ok(()) => CoTaskMemPWSTR::from(p).to_string(),
                    Err(_) => String::new(),
                }
            });
            let target = ua.unwrap_or_else(|| original.clone());
            if target.is_empty() {
                return;
            }
            let value = CoTaskMemPWSTR::from(target.as_str());
            let _ = s2.SetUserAgent(*value.as_ref().as_pcwstr());
        });
    }
}

#[cfg(not(windows))]
mod platform {
    use tauri::{Runtime, WebviewWindow};
    pub fn set_user_agent<R: Runtime>(_window: &WebviewWindow<R>, _ua: Option<String>) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_flow_hosts() {
        let f = |u: &str| is_login_flow(&u.parse().unwrap());
        assert!(f("https://accounts.google.com/ServiceLogin"));
        assert!(f(
            "https://www.youtube.com/signin?action_handle_signin=true"
        ));
        assert!(!f("https://music.youtube.com/"));
        assert!(LOGIN_URL.parse::<Url>().is_ok());
    }
}
