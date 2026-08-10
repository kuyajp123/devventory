use tauri::State;

use crate::{app::state::AppState, shared::errors::command::CommandError};

use super::{
    dto::{
        AcknowledgeRemindersInput, AgentAccountInput, AgentQuotaIdInput, AgentQuotaInput,
        AgentRecordIdInput,
    },
    model::{AgentAccount, AgentQuotaWindow},
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
