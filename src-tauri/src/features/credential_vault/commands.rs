use std::collections::HashSet;

use tauri::{AppHandle, Emitter, State};

use crate::app::state::AppState;
use crate::features::validation_center::events::emit_validation_changed;
use crate::shared::errors::command::CommandError;

use super::dto::{
    CreateCredentialSourceInput, CreateCredentialsInput, CredentialIdInput, ImportEnvSecretsInput,
    ListCredentialsInput, PasswordInput, PreviewEnvSecretsInput, SecretValueInput, SourceIdInput,
    UpdateCredentialInput, UpdateCredentialSourceInput, ValidatedImportEnvSecrets,
};
use super::model::{
    Credential, CredentialSource, EnvSecretPreviewItem, ImportEnvSecretsResult, VaultStatus,
};

pub(crate) const CREDENTIAL_VAULT_CHANGED_EVENT: &str = "credential-vault://changed";

pub(crate) fn emit_credential_vault_changed(app: &AppHandle) {
    if let Err(error) = app.emit(CREDENTIAL_VAULT_CHANGED_EVENT, ()) {
        tracing::warn!(
            error = %error,
            "failed to emit credential vault changed event"
        );
    }
}

#[tauri::command]
pub(crate) fn get_credential_vault_status(
    state: State<'_, AppState>,
) -> Result<VaultStatus, CommandError> {
    Ok(state.credential_vault_service().status())
}

#[tauri::command]
pub(crate) async fn unlock_credential_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    input: PasswordInput,
) -> Result<VaultStatus, CommandError> {
    let password = input.password().map_err(CommandError::from)?;
    let status = state
        .credential_vault_service()
        .unlock(password)
        .await
        .map_err(CommandError::from)?;
    emit_credential_vault_changed(&app);
    Ok(status)
}

#[tauri::command]
pub(crate) fn lock_credential_vault(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultStatus, CommandError> {
    let status = state
        .credential_vault_service()
        .lock()
        .map_err(CommandError::from)?;
    emit_credential_vault_changed(&app);
    Ok(status)
}

#[tauri::command]
pub(crate) async fn list_credential_sources(
    state: State<'_, AppState>,
) -> Result<Vec<CredentialSource>, CommandError> {
    state
        .credential_vault_service()
        .list_sources()
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub(crate) async fn create_credential_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CreateCredentialSourceInput,
) -> Result<CredentialSource, CommandError> {
    let source = state
        .credential_vault_service()
        .create_source(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    emit_credential_vault_changed(&app);
    Ok(source)
}

#[tauri::command]
pub(crate) async fn update_credential_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: UpdateCredentialSourceInput,
) -> Result<CredentialSource, CommandError> {
    let source = state
        .credential_vault_service()
        .update_source(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    emit_credential_vault_changed(&app);
    Ok(source)
}

#[tauri::command]
pub(crate) async fn delete_credential_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SourceIdInput,
) -> Result<(), CommandError> {
    let projects = state
        .credential_vault_service()
        .delete_source(input.source_id().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_projects(&app, &state, projects).await;
    emit_credential_vault_changed(&app);
    Ok(())
}

#[tauri::command]
pub(crate) async fn list_credentials(
    state: State<'_, AppState>,
    input: ListCredentialsInput,
) -> Result<Vec<Credential>, CommandError> {
    state
        .credential_vault_service()
        .list_credentials(input.source_id().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub(crate) async fn create_credentials(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CreateCredentialsInput,
) -> Result<Vec<Credential>, CommandError> {
    let created = state
        .credential_vault_service()
        .create_credentials(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_projects(
        &app,
        &state,
        created
            .iter()
            .flat_map(|credential| credential.project_ids.iter().copied()),
    )
    .await;
    emit_credential_vault_changed(&app);
    Ok(created)
}

#[tauri::command]
pub(crate) async fn update_credential(
    app: AppHandle,
    state: State<'_, AppState>,
    input: UpdateCredentialInput,
) -> Result<Credential, CommandError> {
    let (credential, affected_projects) = state
        .credential_vault_service()
        .update_credential(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_projects(&app, &state, affected_projects).await;
    emit_credential_vault_changed(&app);
    Ok(credential)
}

#[tauri::command]
pub(crate) async fn replace_credential_secret(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SecretValueInput,
) -> Result<(), CommandError> {
    let (credential_id, value) = input.parse().map_err(CommandError::from)?;
    state
        .credential_vault_service()
        .replace_secret(credential_id, &value)
        .await
        .map_err(CommandError::from)?;
    emit_credential_vault_changed(&app);
    Ok(())
}

#[tauri::command]
pub(crate) async fn remove_credential_secret(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CredentialIdInput,
) -> Result<(), CommandError> {
    state
        .credential_vault_service()
        .remove_secret(input.credential_id().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    emit_credential_vault_changed(&app);
    Ok(())
}

#[tauri::command]
pub(crate) async fn reveal_credential_secret(
    state: State<'_, AppState>,
    input: CredentialIdInput,
) -> Result<String, CommandError> {
    state
        .credential_vault_service()
        .reveal_secret(input.credential_id().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub(crate) async fn delete_credential(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CredentialIdInput,
) -> Result<(), CommandError> {
    let projects = state
        .credential_vault_service()
        .delete_credential(input.credential_id().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_projects(&app, &state, projects).await;
    emit_credential_vault_changed(&app);
    Ok(())
}

#[tauri::command]
pub(crate) async fn preview_env_file_secrets(
    state: State<'_, AppState>,
    input: PreviewEnvSecretsInput,
) -> Result<Vec<EnvSecretPreviewItem>, CommandError> {
    let (project_id, relative_path) = input.parse().map_err(CommandError::from)?;
    state
        .credential_vault_service()
        .preview_env_secrets(project_id, &relative_path)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub(crate) async fn import_env_file_to_vault(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ImportEnvSecretsInput,
) -> Result<ImportEnvSecretsResult, CommandError> {
    let validated: ValidatedImportEnvSecrets = input.try_into().map_err(CommandError::from)?;
    let project_id = validated.project_id;
    let result = state
        .credential_vault_service()
        .import_env_file(validated)
        .await
        .map_err(CommandError::from)?;
    revalidate_projects(&app, &state, [project_id]).await;
    emit_credential_vault_changed(&app);
    Ok(result)
}

async fn revalidate_projects(
    app: &AppHandle,
    state: &AppState,
    project_ids: impl IntoIterator<Item = uuid::Uuid>,
) {
    for project_id in project_ids.into_iter().collect::<HashSet<_>>() {
        match state.validation_service().validate(project_id).await {
            Ok(_) => emit_validation_changed(app, project_id),
            Err(error) => tracing::warn!(
                project_id = %project_id,
                error = %error,
                "credential metadata revalidation failed"
            ),
        }
    }
}
