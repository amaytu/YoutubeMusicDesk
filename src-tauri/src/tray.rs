//! Ícone na bandeja do sistema com controles e opções.

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use tauri_plugin_autostart::ManagerExt;

use crate::{login, media, prefs, settings, window};

/// id do item no menu -> chave da preferência.
const CHECKS: [(&str, &str); 5] = [
    ("autostart", "autostart"),
    ("economy", "economy"),
    ("close_to_tray", "closeToTray"),
    ("media_keys", "mediaKeys"),
    ("island", "island"),
];

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
    let island = CheckMenuItem::with_id(
        app,
        "island",
        "Ilha dinâmica em segundo plano",
        true,
        s.island_enabled,
        None::<&str>,
    )?;
    let reload = MenuItem::with_id(app, "reload", "Recarregar", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let sign_in = MenuItem::with_id(
        app,
        "sign_in",
        "Entrar com Google / Trocar conta",
        true,
        None::<&str>,
    )?;
    let sign_out = MenuItem::with_id(app, "sign_out", "Sair da conta", true, None::<&str>)?;
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
            &island,
            &sep()?,
            &sign_in,
            &sign_out,
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
            "sign_in" => login::start(app),
            "sign_out" => login::sign_out(app),
            "playpause" => media::send(app, media::Cmd::PlayPause),
            "next" => media::send(app, media::Cmd::Next),
            "prev" => media::send(app, media::Cmd::Previous),
            "reload" => prefs::reload_all(app),
            "quit" => app.exit(0),
            // Opções de marcar: aplicadas num só lugar (igual à tela de Configurações).
            id => {
                if let Some(key) = CHECKS.iter().find(|(m, _)| *m == id).map(|(_, k)| *k) {
                    let _ = prefs::apply(app, key, None);
                }
            }
        });

    app.manage(prefs::TrayChecks {
        items: vec![
            ("autostart", autostart),
            ("economy", economy),
            ("closeToTray", close_tray),
            ("mediaKeys", keys),
            ("island", island),
        ],
    });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Mostra a faixa atual no tooltip (estado vindo do player).
pub fn set_track<R: Runtime>(app: &AppHandle<R>, state: &serde_json::Value) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let field = |k: &str| {
        state
            .get(k)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string()
    };
    let (title, artist) = (field("title"), field("artist"));
    let text = if title.is_empty() {
        APP_NAME.to_string()
    } else {
        let mut t = if artist.is_empty() {
            title
        } else {
            format!("{title} — {artist}")
        };
        // Tooltip do Windows aceita no máximo 127 caracteres.
        if t.chars().count() > 120 {
            t = t.chars().take(117).collect::<String>() + "...";
        }
        t
    };
    // O estado chega a cada poucos segundos: só mexe no ícone se o texto mudou.
    static LAST: std::sync::Mutex<String> = std::sync::Mutex::new(String::new());
    let mut last = LAST.lock().unwrap();
    if *last != text {
        let _ = tray.set_tooltip(Some(text.as_str()));
        *last = text;
    }
}
