use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tokio::sync::Mutex;
use tracing::{info, warn};

use super::lifecycle::activate_main_window;
use crate::shared::errors::command::CommandError;

pub(crate) const QUICK_ACCESS_WINDOW_LABEL: &str = "quick-panel";
pub(crate) const DEFAULT_MARGIN_PX: i32 = 12;
pub(crate) const TRAY_SINGLE_CLICK_DELAY_MS: u64 = 600;
const TRAY_DOUBLE_CLICK_SUPPRESSION_MS: u64 = 2_000;

#[derive(Debug)]
pub(crate) struct QuickAccessState {
    prevent_auto_hide: AtomicBool,
    position_initialized: AtomicBool,
    last_focus_lost_ms: AtomicU64,
    last_tray_double_click_ms: AtomicU64,
    click_generation: AtomicU64,
    pending_click_task: Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
}

impl QuickAccessState {
    pub(crate) fn new() -> Self {
        Self {
            prevent_auto_hide: AtomicBool::new(false),
            position_initialized: AtomicBool::new(false),
            last_focus_lost_ms: AtomicU64::new(0),
            last_tray_double_click_ms: AtomicU64::new(0),
            click_generation: AtomicU64::new(0),
            pending_click_task: Arc::new(Mutex::new(None)),
        }
    }

    pub(crate) fn prevent_auto_hide(&self) -> bool {
        self.prevent_auto_hide.load(Ordering::SeqCst)
    }

    pub(crate) fn set_prevent_auto_hide(&self, value: bool) {
        self.prevent_auto_hide.store(value, Ordering::SeqCst);
    }

    pub(crate) fn is_position_initialized(&self) -> bool {
        self.position_initialized.load(Ordering::SeqCst)
    }

    pub(crate) fn set_position_initialized(&self, value: bool) {
        self.position_initialized.store(value, Ordering::SeqCst);
    }

    pub(crate) fn record_focus_lost(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        self.last_focus_lost_ms.store(now, Ordering::SeqCst);
    }

    pub(crate) fn recently_lost_focus(&self, threshold_ms: u64) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let lost_at = self.last_focus_lost_ms.load(Ordering::SeqCst);
        lost_at > 0 && (now.saturating_sub(lost_at) < threshold_ms)
    }

    pub(crate) fn next_click_generation(&self) -> u64 {
        self.click_generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub(crate) fn current_click_generation(&self) -> u64 {
        self.click_generation.load(Ordering::SeqCst)
    }

    pub(crate) fn invalidate_click_generation(&self) {
        self.click_generation.fetch_add(1, Ordering::SeqCst);
    }

    pub(crate) fn record_tray_double_click(&self) {
        self.record_tray_double_click_at(current_time_millis());
    }

    fn record_tray_double_click_at(&self, timestamp_ms: u64) {
        self.last_tray_double_click_ms
            .store(timestamp_ms, Ordering::SeqCst);
    }

    pub(crate) fn should_suppress_tray_single_click(&self) -> bool {
        self.should_suppress_tray_single_click_at(current_time_millis())
    }

    fn should_suppress_tray_single_click_at(&self, timestamp_ms: u64) -> bool {
        let double_click_at = self.last_tray_double_click_ms.load(Ordering::SeqCst);
        double_click_at > 0
            && timestamp_ms.saturating_sub(double_click_at) <= TRAY_DOUBLE_CLICK_SUPPRESSION_MS
    }

    pub(crate) async fn cancel_pending_click(&self) {
        let mut guard = self.pending_click_task.lock().await;
        if let Some(handle) = guard.take() {
            handle.abort();
        }
    }

    pub(crate) async fn set_pending_click(&self, handle: tauri::async_runtime::JoinHandle<()>) {
        let mut guard = self.pending_click_task.lock().await;
        if let Some(old_handle) = guard.take() {
            old_handle.abort();
        }
        *guard = Some(handle);
    }
}

fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub(crate) fn compute_bottom_right_position(
    work_area_pos: (i32, i32),
    work_area_size: (u32, u32),
    window_size: (u32, u32),
    margin: i32,
) -> (i32, i32) {
    let x = work_area_pos.0 + work_area_size.0 as i32 - window_size.0 as i32 - margin;
    let y = work_area_pos.1 + work_area_size.1 as i32 - window_size.1 as i32 - margin;
    (x, y)
}

pub(crate) fn position_quick_access_window(app: &AppHandle, window: &WebviewWindow) -> bool {
    let cursor_pos = app.cursor_position().ok();

    let monitor = cursor_pos
        .and_then(|pos| app.monitor_from_point(pos.x, pos.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        warn!("Failed to obtain target monitor for Quick Access window positioning");
        return false;
    };

    let work_area = monitor.work_area();
    let window_size = window
        .outer_size()
        .unwrap_or_else(|_| PhysicalSize::new(360, 260));

    let (target_x, target_y) = compute_bottom_right_position(
        (work_area.position.x, work_area.position.y),
        (work_area.size.width, work_area.size.height),
        (window_size.width, window_size.height),
        DEFAULT_MARGIN_PX,
    );

    if let Err(err) = window.set_position(PhysicalPosition::new(target_x, target_y)) {
        warn!(error = %err, "Failed to set Quick Access window position");
        false
    } else {
        info!(
            x = target_x,
            y = target_y,
            "Positioned Quick Access window to work area bottom-right"
        );
        true
    }
}

pub(crate) fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(err) = window.hide() {
            warn!(error = %err, "Failed to hide main window");
        }
    }
}

pub(crate) fn hide_quick_access(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(QUICK_ACCESS_WINDOW_LABEL) {
        if let Err(err) = window.hide() {
            warn!(error = %err, "Failed to hide Quick Access window");
        }
    }
}

pub(crate) fn show_main_exclusive(app: &AppHandle) -> Result<(), String> {
    match activate_main_window(app) {
        Ok(()) => {
            hide_quick_access(app);
            Ok(())
        }
        Err(err) => {
            warn!(error = %err, "Failed to activate main window; keeping Quick Access visible if active");
            Err(err)
        }
    }
}

pub(crate) fn show_quick_access_exclusive(app: &AppHandle) {
    let Some(window) = app.get_webview_window(QUICK_ACCESS_WINDOW_LABEL) else {
        warn!("Quick Access window not found during show_quick_access_exclusive");
        return;
    };

    if let Some(state) = app.try_state::<QuickAccessState>() {
        if !state.is_position_initialized() && position_quick_access_window(app, &window) {
            state.set_position_initialized(true);
        }
    }

    let show_res = window.show();
    let _ = window.set_focus();

    if show_res.is_ok() {
        hide_main_window(app);
    } else {
        warn!(
            error = ?show_res.err(),
            "Failed to show Quick Access window; keeping main window visible"
        );
    }
}

pub(crate) fn toggle_quick_access_exclusive(app: &AppHandle) {
    let state = app.try_state::<QuickAccessState>();

    if let Some(ref state) = state {
        if state.recently_lost_focus(250) {
            info!("Ignoring toggle request because Quick Access was recently hidden by focus loss");
            return;
        }
    }

    let is_main_visible = app
        .get_webview_window("main")
        .map(|w| w.is_visible().unwrap_or(false))
        .unwrap_or(false);

    let is_quick_visible = app
        .get_webview_window(QUICK_ACCESS_WINDOW_LABEL)
        .map(|w| w.is_visible().unwrap_or(false))
        .unwrap_or(false);

    if is_main_visible || !is_quick_visible {
        show_quick_access_exclusive(app);
    } else {
        hide_quick_access(app);
    }
}

pub(crate) fn handle_quick_access_focus_changed(app: &AppHandle, focused: bool) {
    if focused {
        return;
    }

    if let Some(state) = app.try_state::<QuickAccessState>() {
        state.record_focus_lost();

        if state.prevent_auto_hide() {
            info!("Quick Access focus lost but auto-hide is prevented by active state");
            return;
        }
    }

    hide_quick_access(app);
}

// Pure decision model for mutually exclusive surface transitions (Unit Testable)

#[allow(dead_code)]
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub(crate) enum ExclusiveWindowState {
    MainVisibleQuickHidden,
    MainHiddenQuickVisible,
    BothHidden,
}

#[allow(dead_code)]
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub(crate) enum WindowAction {
    OpenMain,
    OpenQuick,
    CloseQuick,
    CloseMain,
    ToggleQuick,
}

#[allow(dead_code)]
pub(crate) fn resolve_exclusive_target_state(
    is_main_visible: bool,
    is_quick_visible: bool,
    action: WindowAction,
) -> ExclusiveWindowState {
    match action {
        WindowAction::OpenMain => ExclusiveWindowState::MainVisibleQuickHidden,
        WindowAction::OpenQuick => ExclusiveWindowState::MainHiddenQuickVisible,
        WindowAction::CloseQuick => ExclusiveWindowState::BothHidden,
        WindowAction::CloseMain => ExclusiveWindowState::BothHidden,
        WindowAction::ToggleQuick => {
            if is_main_visible || !is_quick_visible {
                ExclusiveWindowState::MainHiddenQuickVisible
            } else {
                ExclusiveWindowState::BothHidden
            }
        }
    }
}

// IPC Commands exposed to Quick Access frontend

#[tauri::command]
pub(crate) async fn hide_quick_access_command(app: tauri::AppHandle) -> Result<(), CommandError> {
    hide_quick_access(&app);
    Ok(())
}

#[tauri::command]
pub(crate) async fn open_main_window_from_quick_access_command(
    app: tauri::AppHandle,
) -> Result<(), CommandError> {
    show_main_exclusive(&app).map_err(|_err| {
        CommandError::operation_unavailable("Failed to activate main application window.")
    })
}

#[tauri::command]
pub(crate) async fn set_quick_access_prevent_auto_hide_command(
    app: tauri::AppHandle,
    prevent: bool,
) -> Result<(), CommandError> {
    if let Some(state) = app.try_state::<QuickAccessState>() {
        state.set_prevent_auto_hide(prevent);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_bottom_right_position_correctly() {
        let work_area_pos = (100, 100);
        let work_area_size = (1920, 1040);
        let window_size = (360, 260);
        let margin = 12;

        let (x, y) =
            compute_bottom_right_position(work_area_pos, work_area_size, window_size, margin);

        assert_eq!(x, 100 + 1920 - 360 - 12); // 1648
        assert_eq!(y, 100 + 1040 - 260 - 12); // 868
    }

    #[test]
    fn tracks_prevent_auto_hide_state() {
        let state = QuickAccessState::new();
        assert!(!state.prevent_auto_hide());
        assert!(!state.is_position_initialized());

        state.set_prevent_auto_hide(true);
        assert!(state.prevent_auto_hide());

        state.set_position_initialized(true);
        assert!(state.is_position_initialized());
    }

    #[test]
    fn tracks_click_generation_and_invalidation() {
        let state = QuickAccessState::new();
        assert_eq!(state.current_click_generation(), 0);

        let gen1 = state.next_click_generation();
        assert_eq!(gen1, 1);
        assert_eq!(state.current_click_generation(), 1);

        state.invalidate_click_generation();
        assert_ne!(state.current_click_generation(), gen1);

        let gen2 = state.next_click_generation();
        assert_eq!(gen2, 3);
        assert_eq!(state.current_click_generation(), 3);
    }

    #[test]
    fn suppresses_the_trailing_single_click_after_a_tray_double_click() {
        let state = QuickAccessState::new();

        state.record_tray_double_click_at(1_000);

        assert!(state.should_suppress_tray_single_click_at(1_100));
        assert!(state.should_suppress_tray_single_click_at(2_500));
        assert!(!state.should_suppress_tray_single_click_at(3_001));
        assert_eq!(TRAY_SINGLE_CLICK_DELAY_MS, 600);
    }

    #[test]
    fn quick_access_capability_allows_native_window_dragging() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/quick-access.json"))
                .expect("quick access capability should contain valid JSON");
        let permissions = capability["permissions"]
            .as_array()
            .expect("quick access permissions should be an array");

        assert!(permissions
            .iter()
            .any(|permission| permission == "core:window:allow-start-dragging"));
    }

    #[test]
    fn resolves_mutually_exclusive_window_states() {
        // Opening main from any initial state always results in MainVisibleQuickHidden
        assert_eq!(
            resolve_exclusive_target_state(false, true, WindowAction::OpenMain),
            ExclusiveWindowState::MainVisibleQuickHidden
        );
        assert_eq!(
            resolve_exclusive_target_state(true, false, WindowAction::OpenMain),
            ExclusiveWindowState::MainVisibleQuickHidden
        );
        assert_eq!(
            resolve_exclusive_target_state(false, false, WindowAction::OpenMain),
            ExclusiveWindowState::MainVisibleQuickHidden
        );

        // Opening Quick Access from any initial state always results in MainHiddenQuickVisible
        assert_eq!(
            resolve_exclusive_target_state(true, false, WindowAction::OpenQuick),
            ExclusiveWindowState::MainHiddenQuickVisible
        );
        assert_eq!(
            resolve_exclusive_target_state(false, false, WindowAction::OpenQuick),
            ExclusiveWindowState::MainHiddenQuickVisible
        );

        // Closing Quick Access or Main when target closed results in BothHidden
        assert_eq!(
            resolve_exclusive_target_state(false, true, WindowAction::CloseQuick),
            ExclusiveWindowState::BothHidden
        );
        assert_eq!(
            resolve_exclusive_target_state(true, false, WindowAction::CloseMain),
            ExclusiveWindowState::BothHidden
        );

        // Toggle Quick Access:
        // Case 1: Main visible -> hide Main, show Quick Access
        assert_eq!(
            resolve_exclusive_target_state(true, false, WindowAction::ToggleQuick),
            ExclusiveWindowState::MainHiddenQuickVisible
        );
        // Case 2: Both hidden -> show Quick Access
        assert_eq!(
            resolve_exclusive_target_state(false, false, WindowAction::ToggleQuick),
            ExclusiveWindowState::MainHiddenQuickVisible
        );
        // Case 3: Quick visible -> hide Quick Access (enters tray-only BothHidden state)
        assert_eq!(
            resolve_exclusive_target_state(false, true, WindowAction::ToggleQuick),
            ExclusiveWindowState::BothHidden
        );
    }
}
