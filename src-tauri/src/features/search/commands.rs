use tauri::State;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::model::{SearchHistoryEntry, SearchMetadataPage, SearchMetadataRequest};

#[tauri::command]
pub(crate) async fn search_metadata(
    state: State<'_, AppState>,
    request: SearchMetadataRequest,
) -> Result<SearchMetadataPage, CommandError> {
    state
        .search_service()
        .search(request)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn record_search_history(
    state: State<'_, AppState>,
    request: SearchMetadataRequest,
) -> Result<Option<SearchHistoryEntry>, CommandError> {
    state
        .search_service()
        .record_history(request)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn list_search_history(
    state: State<'_, AppState>,
) -> Result<Vec<SearchHistoryEntry>, CommandError> {
    state.search_service().history().await.map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn delete_search_history(
    state: State<'_, AppState>,
    history_id: String,
) -> Result<(), CommandError> {
    state
        .search_service()
        .delete_history(history_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn clear_search_history(state: State<'_, AppState>) -> Result<(), CommandError> {
    state
        .search_service()
        .clear_history()
        .await
        .map_err(Into::into)
}
