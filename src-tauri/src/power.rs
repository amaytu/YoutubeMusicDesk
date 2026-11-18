//! Modo economia: reduz o consumo enquanto a janela está escondida/minimizada.
//!
//! - WebView2 `MemoryUsageTargetLevel = Low`: o runtime descarta caches e
//!   compacta memória dos processos do navegador (o áudio continua tocando).
//! - EcoQoS (`ProcessPowerThrottling`): o Windows agenda o processo host em
//!   núcleos de eficiência / frequência menor. O host quase não trabalha, então
//!   não há impacto no áudio, que roda nos processos do WebView2.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, Runtime};

static IN_BACKGROUND: AtomicBool = AtomicBool::new(false);

/// Aplica (ou desfaz) o modo economia em todas as webviews do app.
pub fn set_background<R: Runtime>(app: &AppHandle<R>, background: bool) {
    // Evita chamadas repetidas (Resized dispara várias vezes).
    if IN_BACKGROUND.swap(background, Ordering::SeqCst) == background {
        return;
    }
    for window in app.webview_windows().values() {
        platform::apply_webview(window, background);
    }
    platform::set_eco_qos(background);
}

#[cfg(windows)]
mod platform {
    use tauri::{Runtime, WebviewWindow};
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows::core::Interface;
    use windows::Win32::System::Threading::{
        GetCurrentProcess, ProcessPowerThrottling, SetProcessInformation,
        PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        PROCESS_POWER_THROTTLING_STATE,
    };

    pub fn apply_webview<R: Runtime>(window: &WebviewWindow<R>, background: bool) {
        let _ = window.with_webview(move |wv| unsafe {
            let level = if background {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
            } else {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
            };
            if let Ok(core) = wv.controller().CoreWebView2() {
                // ICoreWebView2_19 exige runtime WebView2 >= 1.0.2210 (Win10/11 atuais já têm).
                if let Ok(core19) = core.cast::<ICoreWebView2_19>() {
                    let _ = core19.SetMemoryUsageTargetLevel(level);
                }
            }
        });
    }

    pub fn set_eco_qos(enabled: bool) {
        let state = PROCESS_POWER_THROTTLING_STATE {
            Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
            // ControlMask 0 = devolve a decisão ao Windows.
            ControlMask: if enabled {
                PROCESS_POWER_THROTTLING_EXECUTION_SPEED
            } else {
                0
            },
            StateMask: if enabled {
                PROCESS_POWER_THROTTLING_EXECUTION_SPEED
            } else {
                0
            },
        };
        unsafe {
            let _ = SetProcessInformation(
                GetCurrentProcess(),
                ProcessPowerThrottling,
                &state as *const _ as *const core::ffi::c_void,
                std::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
            );
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use tauri::{Runtime, WebviewWindow};
    pub fn apply_webview<R: Runtime>(_window: &WebviewWindow<R>, _background: bool) {}
    pub fn set_eco_qos(_enabled: bool) {}
}
