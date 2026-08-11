use tauri::{AppHandle, State};

use crate::app::state::AppState;
use crate::features::validation_center::events::emit_validation_changed;
use crate::shared::errors::command::CommandError;

use super::dto::{
    AddEnvironmentSourceInput, CopyCustomEnvironmentKeyInput, CopyCustomEnvironmentSourceInput,
    CreateCustomEnvironmentSourceInput, CreateEnvironmentInput, CustomEnvironmentKeyIdInput,
    CustomEnvironmentKeyInput, EnvironmentIdInput, EnvironmentMatrixQueryInput,
    EnvironmentOrderInput, EnvironmentSourceCandidateQueryInput, EnvironmentSourceIdInput,
    EnvironmentSourceOrderInput, ProjectInput, RenameCustomEnvironmentSourceInput,
    UpdateEnvironmentInput,
};
use super::model::{
    CustomEnvironmentKey, CustomEnvironmentSource, Environment, EnvironmentMatrixPage,
    EnvironmentSource, EnvironmentSourceCandidatePage,
};

#[tauri::command]
pub(crate) async fn list_environments(
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<Vec<Environment>, CommandError> {
    state
        .environment_service()
        .list(input.project_id().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn create_environment(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CreateEnvironmentInput,
) -> Result<Environment, CommandError> {
    let environment = state
        .environment_service()
        .create(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, environment.project_id).await;
    Ok(environment)
}

#[tauri::command]
pub(crate) async fn update_environment(
    app: AppHandle,
    state: State<'_, AppState>,
    input: UpdateEnvironmentInput,
) -> Result<Environment, CommandError> {
    let environment = state
        .environment_service()
        .update(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, environment.project_id).await;
    Ok(environment)
}

#[tauri::command]
pub(crate) async fn delete_environment(
    app: AppHandle,
    state: State<'_, AppState>,
    input: EnvironmentIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .delete(project_id, environment_id)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn reorder_environments(
    app: AppHandle,
    state: State<'_, AppState>,
    input: EnvironmentOrderInput,
) -> Result<(), CommandError> {
    let (project_id, environment_ids) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .reorder(project_id, environment_ids)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn list_environment_sources(
    state: State<'_, AppState>,
    input: EnvironmentIdInput,
) -> Result<Vec<EnvironmentSource>, CommandError> {
    let (project_id, environment_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .list_sources(project_id, environment_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn add_environment_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: AddEnvironmentSourceInput,
) -> Result<EnvironmentSource, CommandError> {
    let (project_id, environment_id, relative_path) = input.parse().map_err(CommandError::from)?;
    let source = state
        .environment_service()
        .add_source(project_id, environment_id, relative_path)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(source)
}

#[tauri::command]
pub(crate) async fn delete_environment_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: EnvironmentSourceIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id, source_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .delete_source(project_id, environment_id, source_id)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn reorder_environment_sources(
    app: AppHandle,
    state: State<'_, AppState>,
    input: EnvironmentSourceOrderInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id, source_ids) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .reorder_sources(project_id, environment_id, source_ids)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn list_custom_environment_sources(
    state: State<'_, AppState>,
    input: EnvironmentIdInput,
) -> Result<Vec<CustomEnvironmentSource>, CommandError> {
    let (project_id, environment_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .list_custom_sources(project_id, environment_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn create_custom_environment_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CreateCustomEnvironmentSourceInput,
) -> Result<CustomEnvironmentSource, CommandError> {
    let source = state
        .environment_service()
        .create_custom_source(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, source.project_id).await;
    Ok(source)
}

#[tauri::command]
pub(crate) async fn rename_custom_environment_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: RenameCustomEnvironmentSourceInput,
) -> Result<CustomEnvironmentSource, CommandError> {
    let (project_id, environment_id, source_id, name) =
        input.parse().map_err(CommandError::from)?;
    let source = state
        .environment_service()
        .rename_custom_source(project_id, environment_id, source_id, name)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(source)
}

#[tauri::command]
pub(crate) async fn delete_custom_environment_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: EnvironmentSourceIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id, source_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .delete_custom_source(project_id, environment_id, source_id)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn add_custom_environment_key(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CustomEnvironmentKeyInput,
) -> Result<CustomEnvironmentKey, CommandError> {
    let (project_id, environment_id, source_id, name) =
        input.parse().map_err(CommandError::from)?;
    let key = state
        .environment_service()
        .add_custom_key(project_id, environment_id, source_id, name)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(key)
}

#[tauri::command]
pub(crate) async fn delete_custom_environment_key(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CustomEnvironmentKeyIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id, source_id, key_id) =
        input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .delete_custom_key(project_id, environment_id, source_id, key_id)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn copy_custom_environment_key(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CopyCustomEnvironmentKeyInput,
) -> Result<CustomEnvironmentKey, CommandError> {
    let key = state
        .environment_service()
        .copy_custom_key(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, key.project_id).await;
    Ok(key)
}

#[tauri::command]
pub(crate) async fn copy_custom_environment_source(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CopyCustomEnvironmentSourceInput,
) -> Result<CustomEnvironmentSource, CommandError> {
    let source = state
        .environment_service()
        .copy_custom_source(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, source.project_id).await;
    Ok(source)
}

#[tauri::command]
pub(crate) async fn list_environment_source_candidates(
    state: State<'_, AppState>,
    input: EnvironmentSourceCandidateQueryInput,
) -> Result<EnvironmentSourceCandidatePage, CommandError> {
    state
        .environment_service()
        .source_candidates(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn get_environment_matrix(
    state: State<'_, AppState>,
    input: EnvironmentMatrixQueryInput,
) -> Result<EnvironmentMatrixPage, CommandError> {
    state
        .environment_workspace_service()
        .matrix(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn refresh_environment(
    app: AppHandle,
    state: State<'_, AppState>,
    input: EnvironmentIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .refresh_environment(project_id, environment_id)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn refresh_project_environment_sources(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<u64, CommandError> {
    let project_id = input.project_id().map_err(CommandError::from)?;
    let refreshed = state
        .environment_service()
        .refresh_project_sources(project_id, true)
        .await
        .map_err(CommandError::from)?;
    revalidate_after_change(&app, &state, project_id).await;
    Ok(u64::try_from(refreshed).unwrap_or(u64::MAX))
}

async fn revalidate_after_change(app: &AppHandle, state: &AppState, project_id: uuid::Uuid) {
    match state.validation_service().validate(project_id).await {
        Ok(_) => emit_validation_changed(app, project_id),
        Err(error) => tracing::warn!(
            project_id = %project_id,
            error = %error,
            "environment metadata revalidation failed"
        ),
    }
}
