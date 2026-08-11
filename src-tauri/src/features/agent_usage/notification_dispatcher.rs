use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tracing::{error, info};
use uuid::Uuid;

use super::{
    model::{AgentReminder, ReminderBatch, ReminderOutcome},
    service::AgentUsageService,
};
use crate::features::settings::repository::{SettingsRepository, SqliteSettingsRepository};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MainWindowContext {
    Focused,
    Background,
    Unknown,
}

pub(crate) fn get_main_window_context(app: &AppHandle) -> MainWindowContext {
    let Some(window) = app.get_webview_window("main") else {
        return MainWindowContext::Unknown;
    };
    let is_visible = window.is_visible().unwrap_or(false);
    let is_minimized = window.is_minimized().unwrap_or(false);
    let is_focused = window.is_focused().unwrap_or(false);

    if is_visible && !is_minimized && is_focused {
        MainWindowContext::Focused
    } else {
        MainWindowContext::Background
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InAppDeliveryPayload {
    pub(crate) dispatch_id: Uuid,
    pub(crate) batch: ReminderBatch,
}

pub(crate) struct NotificationDispatcher;

impl NotificationDispatcher {
    pub(crate) async fn process_claimed_batch(
        app: &AppHandle,
        service: &AgentUsageService,
        settings_repo: &SqliteSettingsRepository,
        batch: ReminderBatch,
    ) {
        if batch.reminders.is_empty() {
            return;
        }

        let prefs = match settings_repo.get_notification_preferences().await {
            Ok(prefs) => prefs,
            Err(err) => {
                error!(error = %err, "failed to load notification preferences for reminder dispatch");
                let outcomes = batch
                    .reminders
                    .iter()
                    .map(|r| ReminderOutcome::Failed { id: r.id })
                    .collect();
                let _ = service
                    .acknowledge_reminders(batch.batch_token, outcomes)
                    .await;
                return;
            }
        };

        // Master OFF or both channels OFF -> Policy Suppressed
        if !prefs.enabled || (!prefs.in_app_enabled && !prefs.system_enabled) {
            let outcomes = batch
                .reminders
                .iter()
                .map(|r| ReminderOutcome::Suppressed { id: r.id })
                .collect();
            let _ = service
                .acknowledge_reminders(batch.batch_token, outcomes)
                .await;
            return;
        }

        let context = get_main_window_context(app);

        match context {
            MainWindowContext::Focused if prefs.in_app_enabled => {
                // In-App delivery when main window is focused
                let payload = InAppDeliveryPayload {
                    dispatch_id: Uuid::new_v4(),
                    batch,
                };
                if let Err(err) = app.emit("agent-reminders:in-app", &payload) {
                    error!(error = %err, "failed to emit agent-reminders:in-app event");
                }
                // Frontend bridge will render toast and post acknowledge_reminders
            }
            MainWindowContext::Focused
            | MainWindowContext::Background
            | MainWindowContext::Unknown => {
                if prefs.system_enabled {
                    // System Notification delivery
                    Self::dispatch_native_system_notification(app, service, batch).await;
                } else {
                    // System OFF and not eligible for In-App -> Suppress
                    let outcomes = batch
                        .reminders
                        .iter()
                        .map(|r| ReminderOutcome::Suppressed { id: r.id })
                        .collect();
                    let _ = service
                        .acknowledge_reminders(batch.batch_token, outcomes)
                        .await;
                }
            }
        }
    }

    pub(crate) async fn dispatch_native_system_notification(
        app: &AppHandle,
        service: &AgentUsageService,
        batch: ReminderBatch,
    ) {
        let (title, body) = format_notification_content(&batch.reminders);

        match app
            .notification()
            .builder()
            .title(&title)
            .body(&body)
            .show()
        {
            Ok(_) => {
                info!(
                    batch_token = %batch.batch_token,
                    count = batch.reminders.len(),
                    "dispatched native system notification"
                );
                let outcomes = batch
                    .reminders
                    .iter()
                    .map(|r| ReminderOutcome::Delivered { id: r.id })
                    .collect();
                let _ = service
                    .acknowledge_reminders(batch.batch_token, outcomes)
                    .await;
            }
            Err(err) => {
                error!(error = %err, "failed to dispatch native system notification");
                let outcomes = batch
                    .reminders
                    .iter()
                    .map(|r| ReminderOutcome::Failed { id: r.id })
                    .collect();
                let _ = service
                    .acknowledge_reminders(batch.batch_token, outcomes)
                    .await;
            }
        }
    }
}

pub(crate) fn format_notification_content(reminders: &[AgentReminder]) -> (String, String) {
    let title = "Devventory".to_owned();

    if reminders.len() == 1 {
        let r = &reminders[0];
        let platform = r.custom_platform.as_deref().unwrap_or(r.platform.as_str());
        let when = r.reset_at.format("%b %e, %k:%M").to_string();
        let detail = match r.kind {
            super::model::ReminderKind::ResetReached => {
                format!(
                    "{} · {} · {} — Reset time has been reached.",
                    platform, r.identifier, r.quota_label
                )
            }
            super::model::ReminderKind::ResetDay => {
                format!(
                    "{} · {} · {} — Resets today.",
                    platform, r.identifier, r.quota_label
                )
            }
            super::model::ReminderKind::BeforeReset => {
                let diff_hours = (r.reset_at - r.scheduled_for).num_hours().max(1);
                let hour_str = if diff_hours == 1 { "hour" } else { "hours" };
                format!(
                    "{} · {} · {} — Resets in about {} {} ({})",
                    platform, r.identifier, r.quota_label, diff_hours, hour_str, when
                )
            }
        };
        (title, detail)
    } else {
        let count = reminders.len();
        let mut platforms = reminders
            .iter()
            .map(|r| r.custom_platform.as_deref().unwrap_or(r.platform.as_str()))
            .collect::<Vec<_>>();
        platforms.dedup();

        let platform_str = if platforms.len() == 1 {
            platforms[0].to_owned()
        } else if platforms.len() == 2 {
            format!("{} and {}", platforms[0], platforms[1])
        } else {
            format!("{} and others", platforms[0])
        };

        let body = format!(
            "{} Agent Usage reminders are ready. {} have quota updates.",
            count, platform_str
        );
        (title, body)
    }
}
