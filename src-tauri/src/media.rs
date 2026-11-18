//! Controles de reprodução: teclas de mídia globais + comandos enviados à página.

use tauri::{plugin::TauriPlugin, AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

use crate::MAIN_WINDOW;

#[derive(Clone, Copy)]
pub enum Cmd {
    PlayPause,
    Next,
    Previous,
}

impl Cmd {
    fn js(self) -> &'static str {
        match self {
            Cmd::PlayPause => "playPause",
            Cmd::Next => "next",
            Cmd::Previous => "prev",
        }
    }
}

const KEYS: [Code; 3] = [
    Code::MediaPlayPause,
    Code::MediaTrackNext,
    Code::MediaTrackPrevious,
];

pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let cmd = match shortcut.key {
                Code::MediaPlayPause => Cmd::PlayPause,
                Code::MediaTrackNext => Cmd::Next,
                Code::MediaTrackPrevious => Cmd::Previous,
                _ => return,
            };
            send(app, cmd);
        })
        .build()
}

/// Liga/desliga os atalhos globais de mídia.
pub fn set_enabled<R: Runtime>(app: &AppHandle<R>, enabled: bool) {
    let gs = app.global_shortcut();
    let shortcuts = KEYS.map(|k| Shortcut::new(None, k));
    if enabled {
        // Se outro app (ex.: Spotify) já registrou a tecla, apenas ignora.
        for s in shortcuts {
            if !gs.is_registered(s) {
                let _ = gs.register(s);
            }
        }
    } else {
        let _ = gs.unregister_multiple(shortcuts);
    }
}

/// Executa o comando na página do YouTube Music (script injetado em `inject.js`).
pub fn send<R: Runtime>(app: &AppHandle<R>, cmd: Cmd) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.eval(format!("window.__ymd && window.__ymd.{}()", cmd.js()));
    }
}
