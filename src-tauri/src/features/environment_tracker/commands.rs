use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::model::{
    Environment, EnvironmentSource, MatrixPage, MatrixQuery, RefreshSummary, SourceCandidatePage,
    SourceCandidateQuery,
};

const MAX_PAGE_SIZE: u32 = 100;
const MAX_SEARCH_LENGTH: usize = 128;
const MAX_REORDER_ITEMS: usize = 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProjectInput {
    project_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EnvironmentInput {
    project_id: String,
    environment_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SourceInput {
    project_id: String,
    source_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SaveEnvironmentInput {
    project_id: String,
    environment_id: Option<String>,
    name: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReorderInput {
    project_id: String,
    ordered_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AddSourceInput {
    project_id: String,
    environment_id: String,
    relative_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReorderSourcesInput {
    project_id: String,
    environment_id: String,
    ordered_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PageInput {
    project_id: String,
    search: Option<String>,
    page: u32,
    page_size: u32,
}

#[tauri::command]
pub(crate) async fn list_environments(
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<Vec<Environment>, CommandError> {
    state
        .environment_service()
        .list(parse_uuid(&input.project_id)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn create_environment(
    state: State<'_, AppState>,
    input: SaveEnvironmentInput,
) -> Result<Environment, CommandError> {
    if input.environment_id.is_some() {
        return Err(CommandError::invalid_input(
            "The environment request contains invalid data.",
        ));
    }
    state
        .environment_service()
        .create(
            parse_uuid(&input.project_id)?,
            input.name,
            input.description,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn update_environment(
    state: State<'_, AppState>,
    input: SaveEnvironmentInput,
) -> Result<Environment, CommandError> {
    let environment_id = input.environment_id.ok_or_else(|| {
        CommandError::invalid_input("The environment request contains invalid data.")
    })?;
    state
        .environment_service()
        .update(
            parse_uuid(&input.project_id)?,
            parse_uuid(&environment_id)?,
            input.name,
            input.description,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn delete_environment(
    state: State<'_, AppState>,
    input: EnvironmentInput,
) -> Result<(), CommandError> {
    state
        .environment_service()
        .delete(
            parse_uuid(&input.project_id)?,
            parse_uuid(&input.environment_id)?,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn reorder_environments(
    state: State<'_, AppState>,
    input: ReorderInput,
) -> Result<Vec<Environment>, CommandError> {
    state
        .environment_service()
        .reorder_environments(
            parse_uuid(&input.project_id)?,
            parse_ids(input.ordered_ids)?,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn list_environment_source_candidates(
    state: State<'_, AppState>,
    input: PageInput,
) -> Result<SourceCandidatePage, CommandError> {
    let (project_id, search, page, page_size) = parse_page(input)?;
    state
        .environment_service()
        .source_candidates(SourceCandidateQuery {
            project_id,
            search,
            page,
            page_size,
        })
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn add_environment_source(
    state: State<'_, AppState>,
    input: AddSourceInput,
) -> Result<EnvironmentSource, CommandError> {
    state
        .environment_service()
        .add_source(
            parse_uuid(&input.project_id)?,
            parse_uuid(&input.environment_id)?,
            input.relative_path,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn remove_environment_source(
    state: State<'_, AppState>,
    input: SourceInput,
) -> Result<(), CommandError> {
    state
        .environment_service()
        .remove_source(
            parse_uuid(&input.project_id)?,
            parse_uuid(&input.source_id)?,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn reorder_environment_sources(
    state: State<'_, AppState>,
    input: ReorderSourcesInput,
) -> Result<Vec<EnvironmentSource>, CommandError> {
    state
        .environment_service()
        .reorder_sources(
            parse_uuid(&input.project_id)?,
            parse_uuid(&input.environment_id)?,
            parse_ids(input.ordered_ids)?,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn refresh_environment_source(
    state: State<'_, AppState>,
    input: SourceInput,
) -> Result<RefreshSummary, CommandError> {
    state
        .environment_service()
        .refresh_source(
            parse_uuid(&input.project_id)?,
            parse_uuid(&input.source_id)?,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn refresh_environment(
    state: State<'_, AppState>,
    input: EnvironmentInput,
) -> Result<RefreshSummary, CommandError> {
    state
        .environment_service()
        .refresh_environment(
            parse_uuid(&input.project_id)?,
            parse_uuid(&input.environment_id)?,
        )
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn refresh_all_environments(
    state: State<'_, AppState>,
    input: ProjectInput,
) -> Result<RefreshSummary, CommandError> {
    state
        .environment_service()
        .refresh_all(parse_uuid(&input.project_id)?)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn get_environment_matrix(
    state: State<'_, AppState>,
    input: PageInput,
) -> Result<MatrixPage, CommandError> {
    let (project_id, search, page, page_size) = parse_page(input)?;
    state
        .environment_service()
        .matrix(MatrixQuery {
            project_id,
            search,
            page,
            page_size,
        })
        .await
        .map_err(Into::into)
}

fn parse_page(input: PageInput) -> Result<(Uuid, Option<String>, u32, u32), CommandError> {
    let search = input
        .search
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if input.page == 0
        || input.page_size == 0
        || input.page_size > MAX_PAGE_SIZE
        || search
            .as_ref()
            .is_some_and(|value| value.chars().count() > MAX_SEARCH_LENGTH)
    {
        return Err(CommandError::invalid_input(
            "The environment request contains invalid data.",
        ));
    }
    Ok((
        parse_uuid(&input.project_id)?,
        search,
        input.page,
        input.page_size,
    ))
}

fn parse_uuid(value: &str) -> Result<Uuid, CommandError> {
    Uuid::parse_str(value)
        .map_err(|_| CommandError::invalid_input("The environment request contains invalid data."))
}

fn parse_ids(values: Vec<String>) -> Result<Vec<Uuid>, CommandError> {
    if values.len() > MAX_REORDER_ITEMS {
        return Err(CommandError::invalid_input(
            "The environment request contains invalid data.",
        ));
    }
    values
        .iter()
        .map(|value| parse_uuid(value))
        .collect::<Result<Vec<_>, _>>()
}
