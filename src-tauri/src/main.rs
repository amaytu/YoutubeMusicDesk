// Sem console no Windows em release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod island;
mod login;
mod lyrics;
mod media;
mod power;
mod settings;
mod tray;
mod window;

use std::sync::Mutex;
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

/// Interface própria (Svelte).
pub const MAIN_WINDOW: &str = "main";
/// music.youtube.com oculto: toca o áudio e fornece os dados.
pub const PLAYER_WINDOW: &str = "player";
/// Ilha dinâmica (sobreposição no topo da tela).
pub const ISLAND_WINDOW: &str = "island";
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
                .with_denylist(&[PLAYER_WINDOW, ISLAND_WINDOW])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![START_MINIMIZED_ARG]),
        ))
        .plugin(media::plugin())
        .manage(bridge::Bridge::default())
        .manage(island::Island::default())
        .manage(lyrics::LyricsCache::default())
        .invoke_handler(tauri::generate_handler![
            bridge::ytm,
            bridge::player_cmd,
            bridge::show_login,
            bridge::sign_out,
            bridge::bridge_reply,
            bridge::bridge_event,
            island::island_hitbox,
            island::show_main,
            lyrics::synced_lyrics,
        ])
        .setup(|app| {
            let handle = app.handle();
            let s = settings::Settings::load(handle);
            app.manage(settings::SettingsState(Mutex::new(s.clone())));

            let start_hidden = std::env::args().any(|a| a == START_MINIMIZED_ARG);
            window::create_player(handle, &s)?;
            island::create(handle, &window::browser_args(&s))?;
            window::create_main(handle, &s, !start_hidden)?;
            tray::create(handle)?;
            media::set_enabled(handle, s.media_keys);
            Ok(())
        })
        .on_window_event(|win, event| {
            let app = win.app_handle();
            match (win.label(), event) {
                // Fechar a janela de login só a esconde; o player continua tocando.
                (PLAYER_WINDOW, WindowEvent::CloseRequested { api, .. }) => {
                    api.prevent_close();
                    let _ = win.hide();
                    let _ = win.set_skip_taskbar(true);
                    window::show(app);
                }
                (MAIN_WINDOW, WindowEvent::CloseRequested { api, .. }) => {
                    if settings::get(app).close_to_tray {
                        api.prevent_close();
                        window::hide(app);
                    } else {
                        // O player oculto manteria o processo vivo.
                        app.exit(0);
                    }
                }
                (MAIN_WINDOW, WindowEvent::Resized(_)) => {
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
