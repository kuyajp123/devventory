use tauri::State;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

const HEALTHY_MESSAGE: &str = "Devventory Rust backend is running";

#[tauri::command]
pub(crate) async fn health_check(state: State<'_, AppState>) -> Result<String, CommandError> {
    health_check_app(&state).await
}

async fn health_check_app(state: &AppState) -> Result<String, CommandError> {
    state.verify_storage().await.map_err(|error| {
        let command_error = CommandError::from(error);
        tracing::error!(
            error_code = command_error.code(),
            "application health check failed"
        );
        command_error
    })?;

    Ok(HEALTHY_MESSAGE.to_owned())
}

#[cfg(test)]
mod tests;
