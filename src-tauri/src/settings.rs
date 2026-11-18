//! Configurações persistidas em `%APPDATA%\com.amaytu.youtubemusicdesk\settings.json`.

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Fechar (X) esconde na bandeja em vez de encerrar.
    pub close_to_tray: bool,
    /// Ao esconder/minimizar: WebView2 em memória baixa + EcoQoS no processo host.
    pub economy_when_hidden: bool,
    /// Registra Play/Pause, Próxima e Anterior como atalhos globais.
    pub media_keys: bool,
    /// User-Agent customizado (útil se o login do Google reclamar do navegador).
    pub user_agent: Option<String>,
    /// Argumentos extras repassados ao WebView2 (ex.: "--renderer-process-limit=1").
    pub extra_browser_args: Option<String>,
    /// Troca o user agent só durante o login do Google (evita o bloqueio de webview).
    pub login_ua_switch: bool,
    /// User agent usado nas páginas de login (padrão: Firefox no Windows).
    pub login_user_agent: Option<String>,
    /// Ilha dinâmica no topo da tela quando o app está em segundo plano.
    pub island_enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            close_to_tray: true,
            economy_when_hidden: true,
            media_keys: true,
            user_agent: None,
            extra_browser_args: None,
            login_ua_switch: true,
            login_user_agent: None,
            island_enabled: true,
        }
    }
}

pub struct SettingsState(pub Mutex<Settings>);

fn path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("settings.json"))
}

impl Settings {
    pub fn load<R: Runtime>(app: &AppHandle<R>) -> Self {
        path(app)
            .and_then(|p| fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save<R: Runtime>(&self, app: &AppHandle<R>) {
        let Some(p) = path(app) else { return };
        if let Some(dir) = p.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = fs::write(p, json);
        }
    }
}

/// Lê uma cópia das configurações atuais.
pub fn get<R: Runtime>(app: &AppHandle<R>) -> Settings {
    app.state::<SettingsState>().0.lock().unwrap().clone()
}

/// Altera e persiste as configurações.
pub fn update<R: Runtime>(app: &AppHandle<R>, f: impl FnOnce(&mut Settings)) -> Settings {
    let state = app.state::<SettingsState>();
    let mut s = state.0.lock().unwrap();
    f(&mut s);
    s.save(app);
    s.clone()
}
