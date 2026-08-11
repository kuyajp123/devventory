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
use crate::{
    app::notification_session::record_unread_reminders,
    features::settings::model::NotificationPreferences,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MainWindowContext {
    Focused,
    Background,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum NotificationSurfaceContext {
    MainFocused,
    QuickAccessVisible,
    Background,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DeliveryPlan {
    Suppressed,
    InAppToast,
    UnreadOnly,
    UnreadAndSystem,
    SystemOnly,
}

impl DeliveryPlan {
    const fn creates_unread(self) -> bool {
        matches!(
            self,
            Self::InAppToast | Self::UnreadOnly | Self::UnreadAndSystem
        )
    }
}

pub(crate) fn resolve_delivery_plan(
    preferences: &NotificationPreferences,
    context: NotificationSurfaceContext,
) -> DeliveryPlan {
    if !preferences.enabled || (!preferences.in_app_enabled && !preferences.system_enabled) {
        return DeliveryPlan::Suppressed;
    }

    if context == NotificationSurfaceContext::MainFocused && preferences.in_app_enabled {
        return DeliveryPlan::InAppToast;
    }

    match (preferences.in_app_enabled, preferences.system_enabled) {
        (true, true) => DeliveryPlan::UnreadAndSystem,
        (true, false) => DeliveryPlan::UnreadOnly,
        (false, true) => DeliveryPlan::SystemOnly,
        (false, false) => DeliveryPlan::Suppressed,
    }
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

pub(crate) fn get_notification_surface_context(app: &AppHandle) -> NotificationSurfaceContext {
    if get_main_window_context(app) == MainWindowContext::Focused {
        return NotificationSurfaceContext::MainFocused;
    }

    let is_quick_access_visible = app
        .get_webview_window(crate::app::quick_access::QUICK_ACCESS_WINDOW_LABEL)
        .map(|window| window.is_visible().unwrap_or(false))
        .unwrap_or(false);
    if is_quick_access_visible {
        NotificationSurfaceContext::QuickAccessVisible
    } else {
        NotificationSurfaceContext::Background
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

        let plan = resolve_delivery_plan(&prefs, get_notification_surface_context(app));
        if plan == DeliveryPlan::Suppressed {
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

        if plan.creates_unread() {
            record_unread_reminders(app, &batch.reminders);
        }

        match plan {
            DeliveryPlan::InAppToast => {
                // In-App delivery when main window is focused
                let payload = InAppDeliveryPayload {
                    dispatch_id: Uuid::new_v4(),
                    batch,
                };
                if let Err(err) = app.emit_to("main", "agent-reminders:in-app", &payload) {
                    error!(error = %err, "failed to emit agent-reminders:in-app event");
                }
                // Frontend bridge will render toast and post acknowledge_reminders
            }
            DeliveryPlan::UnreadOnly => {
                let outcomes = batch
                    .reminders
                    .iter()
                    .map(|reminder| ReminderOutcome::Delivered { id: reminder.id })
                    .collect();
                let _ = service
                    .acknowledge_reminders(batch.batch_token, outcomes)
                    .await;
            }
            DeliveryPlan::UnreadAndSystem | DeliveryPlan::SystemOnly => {
                Self::dispatch_native_system_notification(app, service, batch).await;
            }
            DeliveryPlan::Suppressed => unreachable!("suppressed batches return before delivery"),
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
