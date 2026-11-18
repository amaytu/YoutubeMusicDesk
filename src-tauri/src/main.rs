// Sem console no Windows em release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod login;
mod media;
mod power;
mod settings;
mod tray;
mod window;

use std::sync::Mutex;
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

pub const MAIN_WINDOW: &str = "main";
const START_MINIMIZED_ARG: &str = "--minimized";

fn main() {
    tauri::Builder::default()
        // Precisa ser o primeiro plugin: uma segunda execução só traz a janela à frente.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show(app)
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                // Visibilidade é controlada por nós (tray / --minimized).
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![START_MINIMIZED_ARG]),
        ))
        .plugin(media::plugin())
        .setup(|app| {
            let handle = app.handle();
            let s = settings::Settings::load(handle);
            app.manage(settings::SettingsState(Mutex::new(s.clone())));

            let start_hidden = std::env::args().any(|a| a == START_MINIMIZED_ARG);
            window::create(handle, &s, !start_hidden)?;
            tray::create(handle)?;
            media::set_enabled(handle, s.media_keys);
            Ok(())
        })
        .on_window_event(|win, event| {
            if win.label() != MAIN_WINDOW {
                return;
            }
            let app = win.app_handle();
            match event {
                WindowEvent::CloseRequested { api, .. } if settings::get(app).close_to_tray => {
                    api.prevent_close();
                    window::hide(app);
                }
                WindowEvent::Resized(_) => {
                    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
                        window::on_resized(&w);
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o YouTube Music Desk");
}
