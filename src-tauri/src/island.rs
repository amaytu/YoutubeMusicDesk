//! "Ilha dinâmica": pílula flutuante no topo da tela enquanto o app está minimizado
//! ou na bandeja. Mostra capa + letra passando; abre no hover com os controles.
//!
//! A janela é transparente e sempre no topo. Para não bloquear cliques no resto da
//! tela, ela ignora o mouse fora da pílula: a página informa o retângulo visível
//! (`island_hitbox`) e uma thread leve (12x/s, só enquanto a ilha está visível)
//! liga/desliga o "atravessar cliques" (WS_EX_TRANSPARENT) conforme o cursor entra ou sai.
//! Em jogos/apresentações em tela cheia a ilha se esconde sozinha.

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{
    AppHandle, Manager, PhysicalPosition, Runtime, Webview, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::{settings, ISLAND_WINDOW};

/// Área máxima da ilha aberta (lógica, px). A pílula fica centralizada no topo.
const WIDTH: f64 = 480.0;
const HEIGHT: f64 = 164.0;
const TOP_MARGIN: f64 = 6.0;

#[derive(Default)]
pub struct Island {
    /// App em segundo plano (minimizado / bandeja).
    background: AtomicBool,
    /// Há uma faixa carregada no player.
    has_track: AtomicBool,
    /// Ilha visível agora.
    shown: AtomicBool,
    polling: AtomicBool,
    /// Retângulo da pílula em px lógicos, relativo à janela.
    hitbox: Mutex<(f64, f64, f64, f64)>,
}

pub fn create<R: Runtime>(app: &AppHandle<R>, browser_args: &str) -> tauri::Result<()> {
    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::new(
        app,
        ISLAND_WINDOW,
        WebviewUrl::App("index.html#island".into()),
    )
    .title("YouTube Music Desk — ilha")
    .inner_size(WIDTH, HEIGHT)
    .decorations(false)
    .transparent(true)
    .background_color(tauri::window::Color(0, 0, 0, 0))
    .shadow(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .focusable(false)
    .visible(false);
    #[cfg(windows)]
    {
        builder = builder.additional_browser_args(browser_args);
    }
    #[cfg(not(windows))]
    let _ = browser_args;
    let w = builder.build()?;
    platform::set_click_through(&w, true);
    Ok(())
}

fn window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app.get_webview_window(ISLAND_WINDOW)
}

/// App foi para segundo plano (true) ou voltou (false).
pub fn set_background<R: Runtime>(app: &AppHandle<R>, background: bool) {
    app.state::<Island>()
        .background
        .store(background, Ordering::SeqCst);
    sync(app);
}

/// Chamado a cada estado do player.
pub fn set_has_track<R: Runtime>(app: &AppHandle<R>, has: bool) {
    let st = app.state::<Island>();
    if st.has_track.swap(has, Ordering::SeqCst) != has {
        sync(app);
    }
}

fn wanted<R: Runtime>(app: &AppHandle<R>) -> bool {
    let st = app.state::<Island>();
    st.background.load(Ordering::SeqCst)
        && st.has_track.load(Ordering::SeqCst)
        && settings::get(app).island_enabled
}

/// Mostra/esconde conforme o estado atual.
pub fn sync<R: Runtime>(app: &AppHandle<R>) {
    if !wanted(app) {
        hide(app);
    } else if platform::fullscreen_app_running() {
        // Fica de olho e aparece quando a tela cheia acabar.
        start_polling(app);
    } else {
        show(app);
    }
}

fn show<R: Runtime>(app: &AppHandle<R>) {
    let Some(w) = window(app) else { return };
    let st = app.state::<Island>();
    if st.shown.swap(true, Ordering::SeqCst) {
        return;
    }
    position(&w);
    platform::set_click_through(&w, true);
    platform::show_no_activate(&w);
    start_polling(app);
}

fn hide<R: Runtime>(app: &AppHandle<R>) {
    let Some(w) = window(app) else { return };
    if app.state::<Island>().shown.swap(false, Ordering::SeqCst) {
        platform::hide(&w);
    }
}

/// Centraliza no topo do monitor principal.
fn position<R: Runtime>(w: &WebviewWindow<R>) {
    let Ok(Some(m)) = w.primary_monitor() else {
        return;
    };
    let scale = m.scale_factor();
    let (mx, my) = (m.position().x as f64, m.position().y as f64);
    let mw = m.size().width as f64;
    let x = mx + (mw - WIDTH * scale) / 2.0;
    let y = my + TOP_MARGIN * scale;
    let _ = w.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
}

/// Liga o mouse só quando o cursor está sobre a pílula; esconde em tela cheia.
fn start_polling<R: Runtime>(app: &AppHandle<R>) {
    let st = app.state::<Island>();
    if st.polling.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    thread::spawn(move || {
        let mut ignoring = true;
        let mut tick = 0u32;
        loop {
            thread::sleep(Duration::from_millis(80));
            let st = app.state::<Island>();
            tick = tick.wrapping_add(1);
            // a cada ~1 s: jogo/apresentação em tela cheia?
            if tick % 12 == 0 {
                let full = platform::fullscreen_app_running();
                let shown = st.shown.load(Ordering::SeqCst);
                if full && shown {
                    hide(&app);
                } else if !full && !shown && wanted(&app) {
                    show(&app);
                }
            }
            if !wanted(&app) {
                break;
            }
            if !st.shown.load(Ordering::SeqCst) {
                continue;
            }
            let Some(w) = window(&app) else { break };
            let (Ok(cursor), Ok(pos), Ok(scale)) =
                (app.cursor_position(), w.outer_position(), w.scale_factor())
            else {
                continue;
            };
            let (hx, hy, hw, hh) = *st.hitbox.lock().unwrap();
            let lx = (cursor.x - pos.x as f64) / scale;
            let ly = (cursor.y - pos.y as f64) / scale;
            let inside = lx >= hx && lx <= hx + hw && ly >= hy && ly <= hy + hh;
            if inside == ignoring {
                ignoring = !inside;
                platform::set_click_through(&w, ignoring);
            }
        }
        if let Some(w) = window(&app) {
            platform::set_click_through(&w, true);
        }
        app.state::<Island>().polling.store(false, Ordering::SeqCst);
    });
}

// ------------------------------------------------------------------ comandos da ilha

#[tauri::command]
pub fn island_hitbox<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    if webview.label() != ISLAND_WINDOW {
        return Err("não permitido".into());
    }
    *app.state::<Island>().hitbox.lock().unwrap() = (x, y, w, h);
    Ok(())
}

#[tauri::command]
pub fn show_main<R: Runtime>(app: AppHandle<R>, webview: Webview<R>) -> Result<(), String> {
    if webview.label() != ISLAND_WINDOW {
        return Err("não permitido".into());
    }
    crate::window::show(&app);
    Ok(())
}

// No Windows a ilha é controlada direto pela API Win32, sem os métodos de
// visibilidade/cursor do Tauri: eles reaplicam o estado interno da janela e,
// como a mostramos com SW_SHOWNOACTIVATE (para não roubar o foco), o Tauri a
// considerava oculta e a escondia (SW_HIDE) assim que o mouse entrava.
#[cfg(windows)]
mod platform {
    use tauri::{Runtime, WebviewWindow};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE,
        QUNS_RUNNING_D3D_FULL_SCREEN,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, ShowWindow, GWL_EXSTYLE, SW_HIDE, SW_SHOWNOACTIVATE,
        WS_EX_LAYERED, WS_EX_TRANSPARENT,
    };

    fn hwnd<R: Runtime>(w: &WebviewWindow<R>) -> Option<HWND> {
        w.hwnd().ok().map(|h| HWND(h.0))
    }

    /// Mostra sem tirar o foco do app que o usuário está usando.
    pub fn show_no_activate<R: Runtime>(w: &WebviewWindow<R>) {
        if let Some(h) = hwnd(w) {
            unsafe {
                let _ = ShowWindow(h, SW_SHOWNOACTIVATE);
            }
        }
    }

    pub fn hide<R: Runtime>(w: &WebviewWindow<R>) {
        if let Some(h) = hwnd(w) {
            unsafe {
                let _ = ShowWindow(h, SW_HIDE);
            }
        }
    }

    /// true = cliques atravessam a janela (fora da pílula).
    pub fn set_click_through<R: Runtime>(w: &WebviewWindow<R>, through: bool) {
        let Some(h) = hwnd(w) else { return };
        unsafe {
            let ex = GetWindowLongPtrW(h, GWL_EXSTYLE);
            let flag = WS_EX_TRANSPARENT.0 as isize;
            // WS_EX_TRANSPARENT só atravessa cliques junto com WS_EX_LAYERED.
            let mut next = ex | WS_EX_LAYERED.0 as isize;
            next = if through { next | flag } else { next & !flag };
            if next != ex {
                SetWindowLongPtrW(h, GWL_EXSTYLE, next);
            }
        }
    }

    /// Jogo em tela cheia, apresentação ou app "ocupado" (ex.: vídeo em tela cheia).
    pub fn fullscreen_app_running() -> bool {
        matches!(
            unsafe { SHQueryUserNotificationState() },
            Ok(s) if s == QUNS_BUSY || s == QUNS_RUNNING_D3D_FULL_SCREEN || s == QUNS_PRESENTATION_MODE
        )
    }
}

#[cfg(not(windows))]
mod platform {
    use tauri::{Runtime, WebviewWindow};
    pub fn show_no_activate<R: Runtime>(w: &WebviewWindow<R>) {
        let _ = w.show();
    }
    pub fn hide<R: Runtime>(w: &WebviewWindow<R>) {
        let _ = w.hide();
    }
    pub fn set_click_through<R: Runtime>(w: &WebviewWindow<R>, through: bool) {
        let _ = w.set_ignore_cursor_events(through);
    }
    pub fn fullscreen_app_running() -> bool {
        false
    }
}
