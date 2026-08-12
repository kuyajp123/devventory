use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::warn;
use uuid::Uuid;

use super::{quick_access::QUICK_ACCESS_WINDOW_LABEL, state::AppState};
use crate::app::quick_access::show_main_exclusive;
use crate::features::agent_usage::AgentReminder;
use crate::shared::errors::command::CommandError;

pub(crate) const UNREAD_CHANGED_EVENT: &str = "agent-reminders:unread-changed";
pub(crate) const NAVIGATE_TO_REMINDER_EVENT: &str = "agent-reminders:navigate";
const MAX_ACKNOWLEDGED_REMINDERS: usize = 512;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct UnreadReminder {
    pub(crate) id: Uuid,
    pub(crate) account_id: Uuid,
    pub(crate) quota_window_id: Uuid,
}

impl From<&AgentReminder> for UnreadReminder {
    fn from(reminder: &AgentReminder) -> Self {
        Self {
            id: reminder.id,
            account_id: reminder.account_id,
            quota_window_id: reminder.quota_window_id,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct UnreadSnapshot {
    pub(crate) reminders: Vec<UnreadReminder>,
    pub(crate) revision: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnreadStatePayload {
    pub(crate) count: usize,
    pub(crate) revision: u64,
    pub(crate) pulse: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "type")]
pub(crate) enum AgentReminderNavigationPayload {
    #[serde(rename = "individual")]
    Individual {
        #[serde(rename = "accountId")]
        account_id: Uuid,
        #[serde(rename = "quotaWindowId")]
        quota_window_id: Uuid,
    },
    #[serde(rename = "burst")]
    Burst,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AcknowledgeUnreadRemindersInput {
    reminder_ids: Vec<String>,
}

impl UnreadSnapshot {
    pub(crate) fn count(&self) -> usize {
        self.reminders.len()
    }

    pub(crate) fn reminder_ids(&self) -> Vec<Uuid> {
        self.reminders.iter().map(|reminder| reminder.id).collect()
    }
}

#[derive(Debug, Default)]
struct NotificationSessionData {
    accepting_unread: bool,
    reminders: BTreeMap<Uuid, UnreadReminder>,
    revision: u64,
    last_show_marker: Option<bool>,
}

#[derive(Debug, Default)]
pub(crate) struct NotificationSessionState {
    data: Mutex<NotificationSessionData>,
}

impl NotificationSessionState {
    pub(crate) fn new(accepting_unread: bool) -> Self {
        Self {
            data: Mutex::new(NotificationSessionData {
                accepting_unread,
                ..NotificationSessionData::default()
            }),
        }
    }

    pub(crate) fn get_and_set_last_marker(&self, show: bool) -> Option<bool> {
        let mut data = self.lock_data();
        let prev = data.last_show_marker;
        data.last_show_marker = Some(show);
        prev
    }

    pub(crate) fn record(&self, reminders: &[AgentReminder]) -> usize {
        let mut data = self.lock_data();
        if !data.accepting_unread {
            return 0;
        }

        let mut added = 0;

        for reminder in reminders {
            if let std::collections::btree_map::Entry::Vacant(entry) =
                data.reminders.entry(reminder.id)
            {
                entry.insert(reminder.into());
                added += 1;
            }
        }

        if added > 0 {
            data.revision = data.revision.saturating_add(1);
        }

        added
    }

    pub(crate) fn set_accepting_unread(&self, accepting_unread: bool) -> bool {
        let mut data = self.lock_data();
        if data.accepting_unread == accepting_unread {
            return false;
        }

        data.accepting_unread = accepting_unread;
        if !accepting_unread {
            data.reminders.clear();
        }
        data.revision = data.revision.saturating_add(1);
        true
    }

    pub(crate) fn snapshot(&self) -> UnreadSnapshot {
        let data = self.lock_data();
        UnreadSnapshot {
            reminders: data.reminders.values().cloned().collect(),
            revision: data.revision,
        }
    }

    pub(crate) fn payload(&self, pulse: bool) -> UnreadStatePayload {
        let snapshot = self.snapshot();
        UnreadStatePayload {
            count: snapshot.count(),
            revision: snapshot.revision,
            pulse,
        }
    }

    pub(crate) fn acknowledge(&self, reminder_ids: &[Uuid]) -> Vec<UnreadReminder> {
        let mut data = self.lock_data();
        let acknowledged = reminder_ids
            .iter()
            .filter_map(|id| data.reminders.remove(id))
            .collect::<Vec<_>>();

        if !acknowledged.is_empty() {
            data.revision = data.revision.saturating_add(1);
        }

        acknowledged
    }

    fn lock_data(&self) -> MutexGuard<'_, NotificationSessionData> {
        self.data
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

pub(crate) const fn should_show_tray_unread(
    unread_count: usize,
    is_quick_access_visible: bool,
) -> bool {
    unread_count > 0 && !is_quick_access_visible
}

pub(crate) fn format_tray_tooltip(unread_count: usize) -> String {
    match unread_count {
        0 => "Devventory".to_owned(),
        1 => "Devventory — 1 unread reminder".to_owned(),
        count => format!("Devventory — {count} unread reminders"),
    }
}

pub(crate) fn with_unread_marker(base: &tauri::image::Image<'_>) -> tauri::image::Image<'static> {
    let width = base.width();
    let height = base.height();
    let mut rgba = base.rgba().to_vec();
    let expected_len = width as usize * height as usize * 4;

    if width == 0 || height == 0 || rgba.len() != expected_len {
        return tauri::image::Image::new_owned(rgba, width, height);
    }

    let radius = (width.min(height) / 6).max(2);
    let outline_radius = radius.saturating_add(1);
    let center_x = width.saturating_sub(radius.saturating_add(1));
    let center_y = radius.saturating_add(1).min(height.saturating_sub(1));

    for y in 0..height {
        for x in 0..width {
            let dx = i64::from(x) - i64::from(center_x);
            let dy = i64::from(y) - i64::from(center_y);
            let distance_squared = dx * dx + dy * dy;
            let marker = if distance_squared <= i64::from(radius * radius) {
                Some([59, 130, 246, 255])
            } else if distance_squared <= i64::from(outline_radius * outline_radius) {
                Some([15, 23, 42, 255])
            } else {
                None
            };

            if let Some(pixel) = marker {
                let index = ((y * width + x) * 4) as usize;
                rgba[index..index + 4].copy_from_slice(&pixel);
            }
        }
    }

    tauri::image::Image::new_owned(rgba, width, height)
}

pub(crate) fn record_unread_reminders(app: &AppHandle, reminders: &[AgentReminder]) {
    let state = app.state::<AppState>().notification_session_state();
    if state.record(reminders) > 0 {
        sync_unread_surfaces(app, true);
    }
}

pub(crate) fn acknowledge_unread_reminders(app: &AppHandle, reminder_ids: &[Uuid]) {
    let state = app.state::<AppState>().notification_session_state();
    if !state.acknowledge(reminder_ids).is_empty() {
        sync_unread_surfaces(app, false);
    }
}

pub(crate) fn set_session_unread_enabled(app: &AppHandle, enabled: bool) {
    let state = app.state::<AppState>().notification_session_state();
    if state.set_accepting_unread(enabled) {
        sync_unread_surfaces(app, false);
    }
}

pub(crate) fn refresh_unread_surfaces(app: &AppHandle) {
    sync_unread_surfaces(app, false);
}

pub(crate) fn navigation_for_snapshot(snapshot: &UnreadSnapshot) -> AgentReminderNavigationPayload {
    if let [reminder] = snapshot.reminders.as_slice() {
        AgentReminderNavigationPayload::Individual {
            account_id: reminder.account_id,
            quota_window_id: reminder.quota_window_id,
        }
    } else {
        AgentReminderNavigationPayload::Burst
    }
}

pub(crate) fn parse_reminder_ids(values: &[String]) -> Result<Vec<Uuid>, CommandError> {
    if values.is_empty() || values.len() > MAX_ACKNOWLEDGED_REMINDERS {
        return Err(CommandError::invalid_input(
            "Select between 1 and 512 reminder IDs to acknowledge.",
        ));
    }

    values
        .iter()
        .map(|value| {
            Uuid::parse_str(value)
                .map_err(|_| CommandError::invalid_input("A reminder ID is not a valid UUID."))
        })
        .collect::<Result<BTreeSet<_>, _>>()
        .map(|ids| ids.into_iter().collect())
}

#[tauri::command]
pub(crate) async fn get_agent_reminder_unread_state(
    state: tauri::State<'_, AppState>,
) -> Result<UnreadStatePayload, CommandError> {
    Ok(state.notification_session_state().payload(false))
}

#[tauri::command]
pub(crate) async fn acknowledge_agent_unread_reminders(
    app: AppHandle,
    input: AcknowledgeUnreadRemindersInput,
) -> Result<(), CommandError> {
    let reminder_ids = parse_reminder_ids(&input.reminder_ids)?;
    acknowledge_unread_reminders(&app, &reminder_ids);
    Ok(())
}

#[tauri::command]
pub(crate) async fn open_agent_unread_from_quick_access(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    let snapshot = state.notification_session_state().snapshot();
    let reminder_ids = snapshot.reminder_ids();
    let navigation = navigation_for_snapshot(&snapshot);

    show_main_exclusive(&app).map_err(|_| {
        CommandError::operation_unavailable("Failed to activate main application window.")
    })?;
    app.emit_to("main", NAVIGATE_TO_REMINDER_EVENT, navigation)
        .map_err(|_| {
            CommandError::operation_unavailable("Failed to navigate to Agent Usage reminders.")
        })?;

    if !reminder_ids.is_empty() {
        acknowledge_unread_reminders(&app, &reminder_ids);
    }
    Ok(())
}

pub(crate) fn get_base_tray_icon(app: &AppHandle) -> Option<tauri::image::Image<'static>> {
    app.default_window_icon()
        .map(|img| tauri::image::Image::new_owned(img.rgba().to_vec(), img.width(), img.height()))
}

fn sync_unread_surfaces(app: &AppHandle, pulse_for_new_reminder: bool) {
    let state = app.state::<AppState>().notification_session_state();
    let is_quick_access_visible = app
        .get_webview_window(QUICK_ACCESS_WINDOW_LABEL)
        .map(|window| window.is_visible().unwrap_or(false))
        .unwrap_or(false);
    let payload = state.payload(pulse_for_new_reminder && is_quick_access_visible);

    if let Err(error) = app.emit_to(QUICK_ACCESS_WINDOW_LABEL, UNREAD_CHANGED_EVENT, payload) {
        warn!(%error, "failed to synchronize Quick Access unread reminder state");
    }

    let Some(tray) = app.tray_by_id("main") else {
        return;
    };
    let show_marker = should_show_tray_unread(payload.count, is_quick_access_visible);
    let tooltip = format_tray_tooltip(if show_marker { payload.count } else { 0 });

    if let Err(error) = tray.set_tooltip(Some(&tooltip)) {
        warn!(%error, "failed to update unread reminder tray tooltip");
    }

    let prev_marker = state.get_and_set_last_marker(show_marker);
    if prev_marker != Some(show_marker) {
        if let Some(base_icon) = get_base_tray_icon(app) {
            let icon = if show_marker {
                with_unread_marker(&base_icon)
            } else {
                base_icon
            };
            if let Err(error) = tray.set_icon(Some(icon)) {
                warn!(%error, "failed to update unread reminder tray icon");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use uuid::Uuid;

    use super::{format_tray_tooltip, should_show_tray_unread, NotificationSessionState};
    use crate::features::agent_usage::{AgentPlatform, AgentReminder, ReminderKind};

    fn reminder(id: Uuid) -> AgentReminder {
        AgentReminder {
            id,
            account_id: Uuid::new_v4(),
            quota_window_id: Uuid::new_v4(),
            kind: ReminderKind::ResetReached,
            platform: AgentPlatform::Codex,
            custom_platform: None,
            identifier: "paul@example.com".to_owned(),
            quota_label: "Weekly".to_owned(),
            reset_at: Utc::now(),
            scheduled_for: Utc::now(),
        }
    }

    #[test]
    fn stores_unique_reminder_ids_for_the_current_session_only() {
        let state = NotificationSessionState::new(true);
        let first = reminder(Uuid::new_v4());
        let second = reminder(Uuid::new_v4());

        assert_eq!(state.snapshot().count(), 0);
        assert_eq!(state.record(&[first.clone(), first.clone(), second]), 2);
        assert_eq!(state.snapshot().count(), 2);
    }

    #[test]
    fn acknowledging_a_captured_snapshot_preserves_later_reminders() {
        let state = NotificationSessionState::new(true);
        let first = reminder(Uuid::new_v4());
        let later = reminder(Uuid::new_v4());

        state.record(std::slice::from_ref(&first));
        let captured_ids = state.snapshot().reminder_ids();
        state.record(std::slice::from_ref(&later));

        let acknowledged = state.acknowledge(&captured_ids);
        assert_eq!(acknowledged.len(), 1);
        assert_eq!(state.snapshot().count(), 1);
    }

    #[test]
    fn tracks_last_marker_state_changes_to_avoid_redundant_icon_updates() {
        let state = NotificationSessionState::new(true);
        assert_eq!(state.get_and_set_last_marker(false), None);
        assert_eq!(state.get_and_set_last_marker(false), Some(false));
        assert_eq!(state.get_and_set_last_marker(true), Some(false));
        assert_eq!(state.get_and_set_last_marker(true), Some(true));
    }

    #[test]
    fn disabling_the_session_removes_unread_without_persistence() {
        let state = NotificationSessionState::new(true);
        state.record(&[reminder(Uuid::new_v4())]);

        assert!(state.set_accepting_unread(false));
        assert_eq!(state.snapshot().count(), 0);
        assert!(!state.set_accepting_unread(false));
    }

    #[test]
    fn tray_unread_is_static_only_while_quick_access_is_hidden() {
        assert!(!should_show_tray_unread(0, false));
        assert!(should_show_tray_unread(1, false));
        assert!(!should_show_tray_unread(1, true));
        assert_eq!(format_tray_tooltip(0), "Devventory");
        assert_eq!(format_tray_tooltip(1), "Devventory — 1 unread reminder");
        assert_eq!(format_tray_tooltip(3), "Devventory — 3 unread reminders");
    }

    #[test]
    fn exposes_count_revision_and_explicit_pulse_without_reminder_details() {
        let state = NotificationSessionState::new(true);
        state.record(&[reminder(Uuid::new_v4())]);

        let payload = state.payload(true);

        assert_eq!(payload.count, 1);
        assert_eq!(payload.revision, 1);
        assert!(payload.pulse);
    }

    #[test]
    fn unread_tray_icon_adds_a_static_marker_without_resizing_the_icon() {
        let base = tauri::image::Image::new_owned(vec![0; 16 * 16 * 4], 16, 16);

        let marked = super::with_unread_marker(&base);

        assert_eq!(marked.width(), 16);
        assert_eq!(marked.height(), 16);
        assert_ne!(marked.rgba(), base.rgba());
        assert!(marked.rgba().chunks_exact(4).any(|pixel| pixel[3] > 0));
    }

    #[test]
    fn quick_access_navigation_targets_one_reminder_and_summarizes_many() {
        let state = NotificationSessionState::new(true);
        let single = reminder(Uuid::new_v4());
        state.record(std::slice::from_ref(&single));

        assert_eq!(
            super::navigation_for_snapshot(&state.snapshot()),
            super::AgentReminderNavigationPayload::Individual {
                account_id: single.account_id,
                quota_window_id: single.quota_window_id,
            }
        );

        state.record(&[reminder(Uuid::new_v4())]);
        assert_eq!(
            super::navigation_for_snapshot(&state.snapshot()),
            super::AgentReminderNavigationPayload::Burst
        );
    }

    #[test]
    fn acknowledgement_input_accepts_unique_uuids_and_rejects_invalid_values() {
        let id = Uuid::new_v4();
        assert_eq!(
            super::parse_reminder_ids(&[id.to_string(), id.to_string()]).unwrap(),
            vec![id]
        );
        assert!(super::parse_reminder_ids(&[]).is_err());
        assert!(super::parse_reminder_ids(&["not-a-uuid".to_owned()]).is_err());
    }

    #[test]
    fn disabling_in_app_unread_clears_and_rejects_in_flight_delivery() {
        let state = NotificationSessionState::new(true);
        state.record(&[reminder(Uuid::new_v4())]);

        assert!(state.set_accepting_unread(false));
        assert_eq!(state.snapshot().count(), 0);
        assert_eq!(state.record(&[reminder(Uuid::new_v4())]), 0);
        assert_eq!(state.snapshot().count(), 0);
    }
}
