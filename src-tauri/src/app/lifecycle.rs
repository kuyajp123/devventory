use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use super::state::AppState;
use crate::features::settings::repository::SettingsRepository;

#[derive(Debug)]
pub(crate) struct ApplicationLifecycleState {
    is_quitting: AtomicBool,
    #[allow(dead_code)]
    is_autostart_launch: AtomicBool,
    is_tray_available: AtomicBool,
}

impl ApplicationLifecycleState {
    pub(crate) fn new(is_autostart_launch: bool) -> Self {
        Self {
            is_quitting: AtomicBool::new(false),
            is_autostart_launch: AtomicBool::new(is_autostart_launch),
            is_tray_available: AtomicBool::new(false),
        }
    }

    pub(crate) fn is_quitting(&self) -> bool {
        self.is_quitting.load(Ordering::SeqCst)
    }

    pub(crate) fn set_quitting(&self, value: bool) {
        self.is_quitting.store(value, Ordering::SeqCst);
    }

    #[allow(dead_code)]
    pub(crate) fn is_autostart_launch(&self) -> bool {
        self.is_autostart_launch.load(Ordering::SeqCst)
    }

    pub(crate) fn is_tray_available(&self) -> bool {
        self.is_tray_available.load(Ordering::SeqCst)
    }

    pub(crate) fn set_tray_available(&self, value: bool) {
        self.is_tray_available.store(value, Ordering::SeqCst);
    }
}

pub(crate) fn activate_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
        if !window.is_visible().unwrap_or(false) {
            let _ = window.show();
        }
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        let err_msg = "Failed to get main webview window during activation".to_string();
        warn!("{}", err_msg);
        Err(err_msg)
    }
}

pub(crate) fn request_quit(app: &AppHandle) {
    info!("Explicit application quit requested");
    if let Some(state) = app.try_state::<AppState>() {
        state.lifecycle_state().set_quitting(true);
    }
    app.exit(0);
}

pub(crate) fn handle_close_requested(
    app: &AppHandle,
    window: &tauri::Window,
    api: &tauri::CloseRequestApi,
) {
    let state = app.state::<AppState>();
    let lifecycle = state.lifecycle_state();

    if lifecycle.is_quitting() {
        return;
    }

    if !lifecycle.is_tray_available() {
        info!("Tray icon unavailable, falling back to full application quit on main window close");
        request_quit(app);
        return;
    }

    let keep_running = tauri::async_runtime::block_on(async {
        state
            .settings_repository()
            .get_background_startup_preferences()
            .await
            .map(|p| p.keep_running_when_closed)
            .unwrap_or(true)
    });

    if keep_running {
        api.prevent_close();
        if let Err(err) = window.hide() {
            warn!(error = %err, "Failed to hide main window; falling back to quit");
            request_quit(app);
        } else {
            info!("Main window hidden to tray; Devventory process remains active");
        }
    } else {
        info!("keep_running_when_closed is false; main window close triggers explicit quit");
        request_quit(app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initializes_lifecycle_state_with_default_flags() {
        let state = ApplicationLifecycleState::new(false);
        assert!(!state.is_quitting());
        assert!(!state.is_autostart_launch());
        assert!(!state.is_tray_available());

        state.set_quitting(true);
        assert!(state.is_quitting());

        state.set_tray_available(true);
        assert!(state.is_tray_available());
    }

    #[test]
    fn tracks_autostart_launch_flag_correctly() {
        let state = ApplicationLifecycleState::new(true);
        assert!(state.is_autostart_launch());
    }
}
