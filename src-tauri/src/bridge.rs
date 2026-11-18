//! Ponte UI <-> página oculta do YouTube Music.
//!
//! UI  --invoke("ytm")-->  Rust  --eval(__ymd.call)-->  página
//! página  --invoke("bridge_reply"/"bridge_event")-->  Rust  --emit("ytm")-->  UI
//!
//! Cada chamada recebe um id; a resposta chega de forma assíncrona e completa o
//! `oneshot` correspondente. Se a página recarregar, as chamadas pendentes falham
//! na hora (em vez de esperar o timeout).

use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};
use tokio::sync::{oneshot, Notify};

use crate::{island, tray, window, ISLAND_WINDOW, MAIN_WINDOW, PLAYER_WINDOW};

const CALL_TIMEOUT: Duration = Duration::from_secs(45);
const READY_TIMEOUT: Duration = Duration::from_secs(25);

type Reply = Result<Value, String>;

#[derive(Default)]
pub struct Bridge {
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Reply>>>,
    ready: AtomicBool,
    ready_notify: Notify,
    signed_in: AtomicBool,
}

impl Bridge {
    /// A página começou a (re)carregar: tudo que estava pendente é cancelado.
    pub fn on_reload(&self) {
        self.ready.store(false, Ordering::SeqCst);
        let drained: Vec<_> = self.pending.lock().unwrap().drain().collect();
        for (_, tx) in drained {
            let _ = tx.send(Err("O YouTube Music recarregou, tente de novo".into()));
        }
    }

    async fn wait_ready(&self) -> Result<(), String> {
        let deadline = tokio::time::Instant::now() + READY_TIMEOUT;
        loop {
            let notified = self.ready_notify.notified();
            if self.ready.load(Ordering::SeqCst) {
                return Ok(());
            }
            if tokio::time::timeout_at(deadline, notified).await.is_err() {
                return Err("O YouTube Music não respondeu. Verifique a conexão.".into());
            }
        }
    }
}

fn player<R: Runtime>(app: &AppHandle<R>) -> Option<tauri::WebviewWindow<R>> {
    app.get_webview_window(PLAYER_WINDOW)
}

/// Executa um método de dados na página e aguarda o resultado.
pub async fn call<R: Runtime>(app: &AppHandle<R>, method: &str, args: Value) -> Reply {
    let bridge = app.state::<Bridge>();
    bridge.wait_ready().await?;
    let id = bridge.next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = oneshot::channel();
    bridge.pending.lock().unwrap().insert(id, tx);

    let js = format!(
        "window.__ymd && window.__ymd.call({id}, {}, {})",
        json!(method),
        args
    );
    let sent = player(app).map(|w| w.eval(js).is_ok()).unwrap_or(false);
    if !sent {
        bridge.pending.lock().unwrap().remove(&id);
        return Err("Player indisponível".into());
    }
    match tokio::time::timeout(CALL_TIMEOUT, rx).await {
        Ok(Ok(reply)) => reply,
        Ok(Err(_)) => Err("Chamada cancelada".into()),
        Err(_) => {
            bridge.pending.lock().unwrap().remove(&id);
            Err("Tempo esgotado ao falar com o YouTube Music".into())
        }
    }
}

/// Comando de reprodução sem resposta (play/pause, próxima, seek...).
pub fn cmd<R: Runtime>(app: &AppHandle<R>, name: &str, arg: Value) {
    if let Some(w) = player(app) {
        let _ = w.eval(format!(
            "window.__ymd && window.__ymd.cmd({}, {})",
            json!(name),
            arg
        ));
    }
}

fn require(webview: &Webview<impl Runtime>, labels: &[&str]) -> Result<(), String> {
    if labels.contains(&webview.label()) {
        Ok(())
    } else {
        Err("não permitido".into())
    }
}

/// UI principal e ilha recebem os mesmos eventos do player.
fn emit_ui<R: Runtime>(app: &AppHandle<R>, payload: Value) {
    for label in [MAIN_WINDOW, ISLAND_WINDOW] {
        let _ = app.emit_to(label, "ytm", payload.clone());
    }
}

// ------------------------------------------------------------------ comandos da UI

#[tauri::command]
pub async fn ytm<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    method: String,
    args: Option<Value>,
) -> Reply {
    require(&webview, &[MAIN_WINDOW, ISLAND_WINDOW])?;
    call(&app, &method, args.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub fn player_cmd<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    name: String,
    arg: Option<Value>,
) -> Result<(), String> {
    require(&webview, &[MAIN_WINDOW, ISLAND_WINDOW])?;
    cmd(&app, &name, arg.unwrap_or(Value::Null));
    Ok(())
}

#[tauri::command]
pub fn show_login<R: Runtime>(app: AppHandle<R>, webview: Webview<R>) -> Result<(), String> {
    require(&webview, &[MAIN_WINDOW])?;
    crate::login::start(&app);
    Ok(())
}

#[tauri::command]
pub fn sign_out<R: Runtime>(app: AppHandle<R>, webview: Webview<R>) -> Result<(), String> {
    require(&webview, &[MAIN_WINDOW])?;
    crate::login::sign_out(&app);
    Ok(())
}

// ------------------------------------------------------------------ comandos da página

#[tauri::command]
pub fn bridge_reply<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    id: u64,
    ok: bool,
    data: Value,
) -> Result<(), String> {
    require(&webview, &[PLAYER_WINDOW])?;
    let bridge = app.state::<Bridge>();
    if let Some(tx) = bridge.pending.lock().unwrap().remove(&id) {
        let reply = if ok {
            Ok(data)
        } else {
            Err(data.as_str().unwrap_or("erro").to_string())
        };
        let _ = tx.send(reply);
    }
    Ok(())
}

#[tauri::command]
pub fn bridge_event<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    kind: String,
    data: Value,
) -> Result<(), String> {
    require(&webview, &[PLAYER_WINDOW])?;
    let bridge = app.state::<Bridge>();
    match kind.as_str() {
        "ready" => {
            let signed_in = data
                .get("signedIn")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let was = bridge.signed_in.swap(signed_in, Ordering::SeqCst);
            bridge.ready.store(true, Ordering::SeqCst);
            bridge.ready_notify.notify_waiters();
            // Login concluído na janela de login: esconde e volta para a UI.
            if signed_in {
                if let Some(p) = player(&app) {
                    if p.is_visible().unwrap_or(false) {
                        let _ = p.hide();
                        window::show(&app);
                    }
                }
            }
            emit_ui(
                &app,
                json!({ "kind": "auth", "data": { "signedIn": signed_in, "changed": was != signed_in } }),
            );
        }
        "state" => {
            tray::set_track(&app, &data);
            let has_track = data
                .get("videoId")
                .and_then(Value::as_str)
                .is_some_and(|v| !v.is_empty());
            island::set_has_track(&app, has_track);
            emit_ui(&app, json!({ "kind": "state", "data": data }));
        }
        _ => {}
    }
    Ok(())
}
