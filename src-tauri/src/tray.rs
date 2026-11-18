//! Ícone na bandeja do sistema com controles e opções.

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use tauri_plugin_autostart::ManagerExt;

use crate::{media, settings, window};

const TRAY_ID: &str = "main-tray";
const APP_NAME: &str = "YouTube Music Desk";

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let s = settings::get(app);
    let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);

    let toggle = MenuItem::with_id(app, "toggle", "Mostrar / Esconder", true, None::<&str>)?;
    let play = MenuItem::with_id(app, "playpause", "Tocar / Pausar", true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "Próxima", true, None::<&str>)?;
    let prev = MenuItem::with_id(app, "prev", "Anterior", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Iniciar com o Windows",
        true,
        autostart_on,
        None::<&str>,
    )?;
    let economy = CheckMenuItem::with_id(
        app,
        "economy",
        "Modo economia em segundo plano",
        true,
        s.economy_when_hidden,
        None::<&str>,
    )?;
    let close_tray = CheckMenuItem::with_id(
        app,
        "close_to_tray",
        "Fechar para a bandeja",
        true,
        s.close_to_tray,
        None::<&str>,
    )?;
    let keys = CheckMenuItem::with_id(
        app,
        "media_keys",
        "Teclas de mídia globais",
        true,
        s.media_keys,
        None::<&str>,
    )?;
    let reload = MenuItem::with_id(app, "reload", "Recarregar", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);

    let menu = Menu::with_items(
        app,
        &[
            &toggle,
            &sep()?,
            &play,
            &next,
            &prev,
            &sep()?,
            &autostart,
            &economy,
            &close_tray,
            &keys,
            &sep()?,
            &reload,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(APP_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::toggle(tray.app_handle());
            }
        })
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "toggle" => window::toggle(app),
            "playpause" => media::send(app, media::Cmd::PlayPause),
            "next" => media::send(app, media::Cmd::Next),
            "prev" => media::send(app, media::Cmd::Previous),
            "autostart" => {
                let al = app.autolaunch();
                let want = !al.is_enabled().unwrap_or(false);
                let _ = if want { al.enable() } else { al.disable() };
                let _ = autostart.set_checked(al.is_enabled().unwrap_or(false));
            }
            "economy" => {
                let s = settings::update(app, |s| s.economy_when_hidden = !s.economy_when_hidden);
                let _ = economy.set_checked(s.economy_when_hidden);
            }
            "close_to_tray" => {
                let s = settings::update(app, |s| s.close_to_tray = !s.close_to_tray);
                let _ = close_tray.set_checked(s.close_to_tray);
            }
            "media_keys" => {
                let s = settings::update(app, |s| s.media_keys = !s.media_keys);
                media::set_enabled(app, s.media_keys);
                let _ = keys.set_checked(s.media_keys);
            }
            "reload" => {
                if let Some(w) = app.get_webview_window(crate::MAIN_WINDOW) {
                    let _ = w.eval("location.reload()");
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Mostra a faixa atual no tooltip (vem do título da página).
pub fn set_track<R: Runtime>(app: &AppHandle<R>, page_title: &str) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let track = page_title.trim_end_matches("- YouTube Music").trim();
    let text = if track.is_empty() || track == "YouTube Music" {
        APP_NAME.to_string()
    } else {
        // Tooltip do Windows aceita no máximo 127 caracteres.
        let mut t: String = format!("{track}\n{APP_NAME}");
        if t.chars().count() > 127 {
            t = t.chars().take(124).collect::<String>() + "...";
        }
        t
    };
    let _ = tray.set_tooltip(Some(text));
}
