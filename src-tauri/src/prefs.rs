//! Preferências editáveis pela tela de Configurações (e pelo menu da bandeja).
//! Um só lugar aplica cada opção, então a bandeja e a tela ficam sempre iguais.

use serde::Serialize;
use serde_json::Value;
use tauri::{menu::CheckMenuItem, AppHandle, Manager, Runtime, Webview};
use tauri_plugin_autostart::ManagerExt;

use crate::{island, media, settings, MAIN_WINDOW};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Prefs {
    pub autostart: bool,
    pub close_to_tray: bool,
    pub economy: bool,
    pub media_keys: bool,
    pub island: bool,
    /// Há uma chave do DeepL salva (a chave em si não volta para a UI).
    pub deepl: bool,
    pub version: String,
}

/// Itens de marcar do menu da bandeja (para refletir mudanças feitas na tela).
pub struct TrayChecks<R: Runtime> {
    pub items: Vec<(&'static str, CheckMenuItem<R>)>,
}

pub fn current<R: Runtime>(app: &AppHandle<R>) -> Prefs {
    let s = settings::get(app);
    Prefs {
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        close_to_tray: s.close_to_tray,
        economy: s.economy_when_hidden,
        media_keys: s.media_keys,
        island: s.island_enabled,
        deepl: s.deepl_api_key.as_deref().is_some_and(|k| !k.trim().is_empty()),
        version: app.package_info().version.to_string(),
    }
}

/// Aplica uma opção. `value` = None alterna (menu da bandeja).
pub fn apply<R: Runtime>(app: &AppHandle<R>, key: &str, value: Option<&Value>) -> Result<Prefs, String> {
    let before = current(app);
    let flag = |old: bool| value.and_then(Value::as_bool).unwrap_or(!old);
    match key {
        "autostart" => {
            let al = app.autolaunch();
            let r = if flag(before.autostart) { al.enable() } else { al.disable() };
            r.map_err(|e| format!("Não foi possível alterar o início automático: {e}"))?;
        }
        "closeToTray" => {
            settings::update(app, |s| s.close_to_tray = flag(before.close_to_tray));
        }
        "economy" => {
            settings::update(app, |s| s.economy_when_hidden = flag(before.economy));
        }
        "mediaKeys" => {
            let s = settings::update(app, |s| s.media_keys = flag(before.media_keys));
            media::set_enabled(app, s.media_keys);
        }
        "island" => {
            settings::update(app, |s| s.island_enabled = flag(before.island));
            island::sync(app);
        }
        "deeplKey" => {
            let k = value.and_then(Value::as_str).map(str::trim).unwrap_or("");
            settings::update(app, |s| s.deepl_api_key = (!k.is_empty()).then(|| k.to_string()));
        }
        _ => return Err(format!("opção desconhecida: {key}")),
    }
    let now = current(app);
    sync_tray(app, &now);
    Ok(now)
}

fn sync_tray<R: Runtime>(app: &AppHandle<R>, p: &Prefs) {
    let Some(checks) = app.try_state::<TrayChecks<R>>() else {
        return;
    };
    for (key, item) in &checks.items {
        let on = match *key {
            "autostart" => p.autostart,
            "closeToTray" => p.close_to_tray,
            "economy" => p.economy,
            "mediaKeys" => p.media_keys,
            "island" => p.island,
            _ => continue,
        };
        let _ = item.set_checked(on);
    }
}

#[tauri::command]
pub fn get_prefs<R: Runtime>(app: AppHandle<R>, webview: Webview<R>) -> Result<Prefs, String> {
    if webview.label() != MAIN_WINDOW {
        return Err("não permitido".into());
    }
    Ok(current(&app))
}

#[tauri::command]
pub fn set_pref<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    key: String,
    value: Value,
) -> Result<Prefs, String> {
    if webview.label() != MAIN_WINDOW {
        return Err("não permitido".into());
    }
    apply(&app, &key, Some(&value))
}

/// Recarrega o player oculto e a interface (menu da bandeja e Configurações).
pub fn reload_all<R: Runtime>(app: &AppHandle<R>) {
    for label in [crate::PLAYER_WINDOW, crate::MAIN_WINDOW] {
        if let Some(w) = app.get_webview_window(label) {
            let _ = w.eval("location.reload()");
        }
    }
}
