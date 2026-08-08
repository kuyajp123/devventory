use tauri::State;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::model::ProjectDashboard;

#[tauri::command]
pub(crate) async fn get_project_dashboard(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ProjectDashboard, CommandError> {
    state
        .dashboard_service()
        .get(project_id)
        .await
        .map_err(Into::into)
}
