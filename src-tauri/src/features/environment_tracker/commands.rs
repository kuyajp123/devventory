use tauri::State;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::dto::{
    AddEnvironmentSourceInput, CreateEnvironmentInput, EnvironmentIdInput,
    EnvironmentMatrixQueryInput, EnvironmentOrderInput, EnvironmentSourceCandidateQueryInput,
    EnvironmentSourceIdInput, EnvironmentSourceOrderInput, ProjectInput, UpdateEnvironmentInput,
};
use super::model::{
    Environment, EnvironmentMatrixPage, EnvironmentSource, EnvironmentSourceCandidatePage,
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
    state: State<'_, AppState>,
    input: CreateEnvironmentInput,
) -> Result<Environment, CommandError> {
    state
        .environment_service()
        .create(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn update_environment(
    state: State<'_, AppState>,
    input: UpdateEnvironmentInput,
) -> Result<Environment, CommandError> {
    state
        .environment_service()
        .update(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn delete_environment(
    state: State<'_, AppState>,
    input: EnvironmentIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .delete(project_id, environment_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn reorder_environments(
    state: State<'_, AppState>,
    input: EnvironmentOrderInput,
) -> Result<(), CommandError> {
    let (project_id, environment_ids) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .reorder(project_id, environment_ids)
        .await
        .map_err(Into::into)
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
    state: State<'_, AppState>,
    input: AddEnvironmentSourceInput,
) -> Result<EnvironmentSource, CommandError> {
    let (project_id, environment_id, relative_path) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .add_source(project_id, environment_id, relative_path)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn delete_environment_source(
    state: State<'_, AppState>,
    input: EnvironmentSourceIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id, source_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .delete_source(project_id, environment_id, source_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn reorder_environment_sources(
    state: State<'_, AppState>,
    input: EnvironmentSourceOrderInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id, source_ids) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .reorder_sources(project_id, environment_id, source_ids)
        .await
        .map_err(Into::into)
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
        .environment_service()
        .matrix(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn refresh_environment(
    state: State<'_, AppState>,
    input: EnvironmentIdInput,
) -> Result<(), CommandError> {
    let (project_id, environment_id) = input.parse().map_err(CommandError::from)?;
    state
        .environment_service()
        .refresh_environment(project_id, environment_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn refresh_project_environment_sources(
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<u64, CommandError> {
    let refreshed = state
        .environment_service()
        .refresh_project_sources(input.project_id().map_err(CommandError::from)?, true)
        .await
        .map_err(CommandError::from)?;
    Ok(u64::try_from(refreshed).unwrap_or(u64::MAX))
}
