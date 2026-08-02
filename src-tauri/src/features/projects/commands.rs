use tauri::State;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::dto::{
    CreateProjectInput, ProjectDto, ScanProjectRootInput, ValidateProjectRootInput,
    ValidatedProjectRootDto,
};
use super::model::InitialScanSummary;
use crate::features::file_inventory::ScanType;

#[tauri::command]
pub(crate) async fn validate_project_root(
    state: State<'_, AppState>,
    input: ValidateProjectRootInput,
) -> Result<ValidatedProjectRootDto, CommandError> {
    state
        .project_service()
        .validate_root(&input.root_path)
        .map(ValidatedProjectRootDto::new)
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn scan_project_root(
    state: State<'_, AppState>,
    input: ScanProjectRootInput,
) -> Result<InitialScanSummary, CommandError> {
    state
        .project_service()
        .preview_scan(input.into())
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> Result<ProjectDto, CommandError> {
    let project = state
        .project_service()
        .create(input.into())
        .await
        .map_err(CommandError::from)?;
    let project_id = project.id;

    if let Err(error) = state
        .file_inventory_service()
        .reconcile_project(project_id, ScanType::Initial)
        .await
    {
        tracing::warn!(project_id = %project_id, error = %error, "initial persistent inventory scan failed");
    }
    if let Err(error) = state.refresh_inventory_watchers().await {
        tracing::warn!(project_id = %project_id, error = %error, "project watcher refresh failed");
    }

    Ok(ProjectDto::from(project))
}

#[tauri::command]
pub(crate) async fn list_projects(
    state: State<'_, AppState>,
) -> Result<Vec<ProjectDto>, CommandError> {
    state
        .project_service()
        .list()
        .await
        .map(|projects| projects.into_iter().map(ProjectDto::from).collect())
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn get_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ProjectDto, CommandError> {
    state
        .project_service()
        .get(&project_id)
        .await
        .map(ProjectDto::from)
        .map_err(Into::into)
}
