use super::{model::SyncStatus, service::ConfigureSync, transport::SyncError};
use crate::{app::state::AppState, shared::errors::command::CommandError};
use tauri::{State, WebviewWindow};
fn main_window(window: &WebviewWindow) -> Result<(), CommandError> {
    if window.label() != "main" {
        return Err(CommandError::operation_unavailable(
            "Cloud Sync is available in the main window.",
        ));
    }
    Ok(())
}
fn command_error(error: SyncError) -> CommandError {
    match error {
        SyncError::InvalidConfiguration => CommandError::cloud_sync_configuration_invalid(),
        SyncError::CredentialUnavailable => CommandError::cloud_sync_credentials_unavailable(),
        SyncError::Storage(_) => {
            CommandError::operation_unavailable("Cloud synchronization storage is unavailable.")
        }
        _ => CommandError::cloud_sync_connection_unavailable(),
    }
}
#[tauri::command]
pub(crate) async fn get_cloud_sync_status(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<SyncStatus, CommandError> {
    main_window(&window)?;
    state
        .cloud_sync_service()
        .status()
        .await
        .map_err(command_error)
}
#[tauri::command]
pub(crate) async fn configure_cloud_sync(
    window: WebviewWindow,
    state: State<'_, AppState>,
    input: ConfigureSync,
) -> Result<SyncStatus, CommandError> {
    main_window(&window)?;
    state
        .cloud_sync_service()
        .configure(input)
        .await
        .map_err(command_error)
}
#[tauri::command]
pub(crate) async fn set_cloud_sync_enabled(
    window: WebviewWindow,
    state: State<'_, AppState>,
    enabled: bool,
    confirmed: bool,
) -> Result<SyncStatus, CommandError> {
    main_window(&window)?;
    state
        .cloud_sync_service()
        .set_enabled(enabled, confirmed)
        .await
        .map_err(command_error)
}
#[tauri::command]
pub(crate) async fn synchronize_cloud_now(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<SyncStatus, CommandError> {
    main_window(&window)?;
    let service = state.cloud_sync_service();
    let _ = service.synchronize(true).await;
    service.status().await.map_err(command_error)
}
#[tauri::command]
pub(crate) async fn rebuild_cloud_sync(
    window: WebviewWindow,
    state: State<'_, AppState>,
    confirmation: String,
) -> Result<SyncStatus, CommandError> {
    main_window(&window)?;
    state
        .cloud_sync_service()
        .rebuild(&confirmation)
        .await
        .map_err(command_error)
}
