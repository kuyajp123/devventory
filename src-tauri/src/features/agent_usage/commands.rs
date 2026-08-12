use chrono::Utc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

use crate::{
    app::state::AppState, features::settings::repository::SettingsRepository,
    shared::errors::command::CommandError,
};

use super::{
    dto::{
        AcknowledgeRemindersInput, AgentAccountInput, AgentQuotaIdInput, AgentQuotaInput,
        AgentRecordIdInput,
    },
    model::{
        AgentAccount, AgentPlatform, AgentQuotaWindow, AgentReminder, ReminderBatch, ReminderKind,
    },
    notification_dispatcher::{get_main_window_context, MainWindowContext},
};

#[tauri::command]
pub(crate) async fn list_agent_accounts(
    state: State<'_, AppState>,
) -> Result<Vec<AgentAccount>, CommandError> {
    state
        .agent_usage_service()
        .list_accounts()
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn save_agent_account(
    state: State<'_, AppState>,
    input: AgentAccountInput,
) -> Result<AgentAccount, CommandError> {
    state
        .agent_usage_service()
        .save_account(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn delete_agent_account(
    state: State<'_, AppState>,
    input: AgentRecordIdInput,
) -> Result<(), CommandError> {
    state
        .agent_usage_service()
        .delete_account(input.id().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn save_agent_quota(
    state: State<'_, AppState>,
    input: AgentQuotaInput,
) -> Result<AgentQuotaWindow, CommandError> {
    state
        .agent_usage_service()
        .save_quota(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn delete_agent_quota(
    state: State<'_, AppState>,
    input: AgentQuotaIdInput,
) -> Result<(), CommandError> {
    let (account_id, quota_id) = input.parse().map_err(CommandError::from)?;
    state
        .agent_usage_service()
        .delete_quota(account_id, quota_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn acknowledge_agent_reminders(
    state: State<'_, AppState>,
    input: AcknowledgeRemindersInput,
) -> Result<(), CommandError> {
    let (batch_token, outcomes) = input.parse().map_err(CommandError::from)?;
    state
        .agent_usage_service()
        .acknowledge_reminders(batch_token, outcomes)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn test_normal_notification(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    if !cfg!(debug_assertions) {
        return Err(CommandError::not_found("Diagnostic command disabled"));
    }

    let prefs = state
        .settings_repository()
        .get_notification_preferences()
        .await
        .map_err(CommandError::from)?;

    if !prefs.enabled || (!prefs.in_app_enabled && !prefs.system_enabled) {
        return Ok("Suppressed by notification preferences".to_owned());
    }

    let synthetic_batch = ReminderBatch {
        batch_token: Uuid::new_v4(),
        reminders: vec![AgentReminder {
            id: Uuid::new_v4(),
            account_id: Uuid::new_v4(),
            quota_window_id: Uuid::new_v4(),
            kind: ReminderKind::ResetReached,
            platform: AgentPlatform::Antigravity,
            custom_platform: None,
            identifier: "diagnostic@devventory.local".to_owned(),
            quota_label: "Diagnostic Quota".to_owned(),
            reset_at: Utc::now(),
            scheduled_for: Utc::now(),
        }],
    };

    let context = get_main_window_context(&app);
    if context == MainWindowContext::Focused && prefs.in_app_enabled {
        let payload = super::notification_dispatcher::InAppDeliveryPayload {
            dispatch_id: Uuid::new_v4(),
            batch: synthetic_batch,
        };
        app.emit("agent-reminders:in-app", &payload)
            .map_err(|_| CommandError::operation_unavailable("In-app notification emit failed"))?;
        Ok("Delivered as in-app notification".to_owned())
    } else if prefs.system_enabled {
        let (title, body) =
            super::notification_dispatcher::format_notification_content(&synthetic_batch.reminders);
        app.notification()
            .builder()
            .title(&title)
            .body(&body)
            .show()
            .map_err(|_| CommandError::operation_unavailable("System notification failed"))?;
        Ok("Delivered as system notification".to_owned())
    } else {
        Ok("Suppressed by notification preferences".to_owned())
    }
}

#[tauri::command]
pub(crate) async fn test_system_channel_directly(app: AppHandle) -> Result<String, CommandError> {
    if !cfg!(debug_assertions) {
        return Err(CommandError::not_found("Diagnostic command disabled"));
    }

    app.notification()
        .builder()
        .title("Devventory Diagnostic")
        .body("Testing System notification delivery directly.")
        .show()
        .map_err(|_| CommandError::operation_unavailable("System notification failed"))?;

    Ok("System notification sent directly".to_owned())
}

#[tauri::command]
pub(crate) async fn emit_agent_usage_changed(app: AppHandle) -> Result<(), CommandError> {
    app.emit("agent-usage://changed", ())
        .map_err(|_| CommandError::operation_unavailable("Failed to emit agent usage changed event"))
}
