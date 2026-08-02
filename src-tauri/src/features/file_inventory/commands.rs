use tauri::State;
use uuid::Uuid;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::dto::{FileInventoryQueryInput, InventoryPageDto, ScanRunDto};
use super::model::{InventoryQuery, ScanType};

#[tauri::command]
pub(crate) async fn list_project_files(
    state: State<'_, AppState>,
    input: FileInventoryQueryInput,
) -> Result<InventoryPageDto, CommandError> {
    let query = InventoryQuery::try_from(input)?;
    state
        .file_inventory_service()
        .query(query)
        .await
        .map(Into::into)
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn rescan_project(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ScanRunDto, CommandError> {
    let project_id = parse_id(&project_id)?;
    state
        .file_inventory_service()
        .reconcile_project(project_id, ScanType::ManualProject)
        .await
        .map(Into::into)
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn rescan_watched_location(
    state: State<'_, AppState>,
    project_id: String,
    watched_location_id: String,
) -> Result<ScanRunDto, CommandError> {
    let project_id = parse_id(&project_id)?;
    let watched_location_id = parse_id(&watched_location_id)?;
    state
        .file_inventory_service()
        .reconcile_watched_location(project_id, watched_location_id)
        .await
        .map(Into::into)
        .map_err(Into::into)
}

fn parse_id(value: &str) -> Result<Uuid, CommandError> {
    Uuid::parse_str(value).map_err(|_| CommandError::invalid_input("The identifier is invalid."))
}
