use tauri::{AppHandle, State};

use crate::{
    app::state::AppState, features::file_inventory::emit_inventory_changed,
    shared::errors::command::CommandError,
};

use super::{
    dto::{
        ExportManifestInput, ManifestInput, ProjectInput, SaveValidationRuleInput,
        ValidationIssueQueryInput, ValidationIssueStatusInput, ValidationRuleIdInput,
        ValidationRuleOrderInput,
    },
    events::emit_validation_changed,
    model::{
        ManifestExport, ManifestPreview, ValidationIssue, ValidationIssuePage, ValidationRule,
        ValidationRunResult, ValidationSummary,
    },
};

#[tauri::command]
pub(crate) async fn list_validation_rules(
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<Vec<ValidationRule>, CommandError> {
    state
        .validation_service()
        .list_rules(input.project_id().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn save_validation_rule(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SaveValidationRuleInput,
) -> Result<ValidationRule, CommandError> {
    let rule = state
        .validation_service()
        .save_rule(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(CommandError::from)?;
    emit_validation_changed(&app, rule.project_id);
    Ok(rule)
}

#[tauri::command]
pub(crate) async fn delete_validation_rule(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ValidationRuleIdInput,
) -> Result<(), CommandError> {
    let (project_id, rule_id) = input.parse().map_err(CommandError::from)?;
    state
        .validation_service()
        .delete_rule(project_id, rule_id)
        .await
        .map_err(CommandError::from)?;
    emit_validation_changed(&app, project_id);
    Ok(())
}

#[tauri::command]
pub(crate) async fn reorder_validation_rules(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ValidationRuleOrderInput,
) -> Result<(), CommandError> {
    let (project_id, rule_ids) = input.parse().map_err(CommandError::from)?;
    state
        .validation_service()
        .reorder_rules(project_id, rule_ids)
        .await
        .map_err(CommandError::from)?;
    emit_validation_changed(&app, project_id);
    Ok(())
}

#[tauri::command]
pub(crate) async fn list_validation_issues(
    state: State<'_, AppState>,
    input: ValidationIssueQueryInput,
) -> Result<ValidationIssuePage, CommandError> {
    state
        .validation_service()
        .list_issues(input.try_into().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn get_validation_summary(
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<ValidationSummary, CommandError> {
    state
        .validation_service()
        .summary(input.project_id().map_err(CommandError::from)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn run_project_validation(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<ValidationRunResult, CommandError> {
    let project_id = input.project_id().map_err(CommandError::from)?;
    let result = state
        .validation_service()
        .validate(project_id)
        .await
        .map_err(CommandError::from)?;
    emit_validation_changed(&app, project_id);
    Ok(result)
}

#[tauri::command]
pub(crate) async fn set_validation_issue_status(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ValidationIssueStatusInput,
) -> Result<ValidationIssue, CommandError> {
    let (project_id, issue_id, status) = input.parse().map_err(CommandError::from)?;
    let issue = state
        .validation_service()
        .set_issue_status(project_id, issue_id, status)
        .await
        .map_err(CommandError::from)?;
    emit_validation_changed(&app, project_id);
    Ok(issue)
}

#[tauri::command]
pub(crate) async fn preview_environment_manifest(
    state: State<'_, AppState>,
    input: ManifestInput,
) -> Result<ManifestPreview, CommandError> {
    let (project_id, relative_path) = input.parse().map_err(CommandError::from)?;
    state
        .validation_service()
        .manifest_preview(project_id, relative_path)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn export_environment_manifest(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ExportManifestInput,
) -> Result<ManifestExport, CommandError> {
    let (project_id, relative_path, collision_choice) =
        input.parse().map_err(CommandError::from)?;
    let exported = state
        .validation_service()
        .export_manifest(project_id, relative_path, collision_choice)
        .await
        .map_err(CommandError::from)?;
    emit_inventory_changed(&app, &exported.scan);
    Ok(exported.manifest)
}
