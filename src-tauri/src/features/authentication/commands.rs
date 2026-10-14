use super::{AuthError, AuthService, AuthSession};
use crate::features::cloud_sync::CloudSyncService;
use crate::{app::state::AppState, shared::errors::command::CommandError};
use serde::Deserialize;
use tauri::{State, WebviewWindow};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SignInInput {
    email: String,
    password: String,
    sign_up: bool,
}
fn main_window(window: &WebviewWindow) -> Result<(), CommandError> {
    if window.label() != "main" {
        return Err(CommandError::operation_unavailable(
            "Account authentication is available in the main window.",
        ));
    }
    Ok(())
}
fn safe(error: AuthError) -> CommandError {
    CommandError::authentication(error.code())
}
#[tauri::command]
pub(crate) async fn get_auth_session(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<AuthSession, CommandError> {
    main_window(&window)?;
    state.authentication_service().session().await.map_err(safe)
}
#[tauri::command]
pub(crate) async fn sign_in_account(
    window: WebviewWindow,
    state: State<'_, AppState>,
    input: SignInInput,
) -> Result<AuthSession, CommandError> {
    main_window(&window)?;
    state.cloud_sync_service().cancel_auth_work();
    let session = state
        .authentication_service()
        .sign_in(input.email, input.password, input.sign_up)
        .await
        .map_err(safe)?;
    let _ = state.cloud_sync_service().authentication_changed().await;
    Ok(session)
}
#[tauri::command]
pub(crate) async fn sign_out_account(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<AuthSession, CommandError> {
    main_window(&window)?;
    sign_out_and_pause(state.authentication_service(), state.cloud_sync_service())
        .await
        .map_err(safe)
}
pub(super) async fn sign_out_and_pause(
    authentication: &AuthService,
    cloud: &CloudSyncService,
) -> Result<AuthSession, AuthError> {
    cloud.cancel_auth_work();
    let result = authentication.sign_out().await;
    // A cloud database failure must never prevent native account credentials being cleared.
    // Owned-workspace publishing also fails closed without an authenticated session.
    let _ = cloud.pause_for_sign_out().await;
    result?;
    authentication.session().await
}
#[tauri::command]
pub(crate) async fn refresh_auth_session(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<AuthSession, CommandError> {
    main_window(&window)?;
    let session = state
        .authentication_service()
        .refresh_session()
        .await
        .map_err(safe)?;
    let _ = state.cloud_sync_service().authentication_changed().await;
    Ok(session)
}
#[tauri::command]
pub(crate) async fn send_auth_verification(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    main_window(&window)?;
    state
        .authentication_service()
        .send_verification()
        .await
        .map_err(safe)
}
#[tauri::command]
pub(crate) async fn reset_account_password(
    window: WebviewWindow,
    state: State<'_, AppState>,
    email: String,
) -> Result<(), CommandError> {
    main_window(&window)?;
    state
        .authentication_service()
        .reset_password(&email)
        .await
        .map_err(safe)
}
