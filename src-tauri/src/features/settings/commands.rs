use tauri::State;
use uuid::Uuid;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::dto::{
    BackgroundStartupPreferencesDto, BackgroundStartupPreferencesInput,
    NotificationPreferencesDto, NotificationPreferencesInput,
};
use super::repository::SettingsRepository;

const LAST_OPENED_PROJECT_KEY: &str = "workspace.last_opened_project_id";

#[tauri::command]
pub(crate) async fn get_last_opened_project_id(
    state: State<'_, AppState>,
) -> Result<Option<String>, CommandError> {
    let repository = state.settings_repository();
    repository
        .find_by_key(LAST_OPENED_PROJECT_KEY)
        .await
        .map(|setting| setting.map(|value| value.value))
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn save_last_opened_project_id(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), CommandError> {
    let project_id = Uuid::parse_str(&project_id)
        .map_err(|_| CommandError::invalid_input("The project ID must be a valid UUID."))?
        .to_string();
    let repository = state.settings_repository();

    repository
        .upsert(LAST_OPENED_PROJECT_KEY, &project_id)
        .await
        .map(|_| ())
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn get_notification_preferences(
    state: State<'_, AppState>,
) -> Result<NotificationPreferencesDto, CommandError> {
    let repository = state.settings_repository();
    let domain = repository
        .get_notification_preferences()
        .await
        .map_err(Into::<CommandError>::into)?;
    Ok(domain.into())
}

#[tauri::command]
pub(crate) async fn save_notification_preferences(
    state: State<'_, AppState>,
    input: NotificationPreferencesInput,
) -> Result<(), CommandError> {
    let repository = state.settings_repository();
    repository
        .save_notification_preferences(input.into())
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub(crate) async fn get_background_startup_preferences(
    state: State<'_, AppState>,
) -> Result<BackgroundStartupPreferencesDto, CommandError> {
    let repository = state.settings_repository();
    let domain = repository
        .get_background_startup_preferences()
        .await
        .map_err(Into::<CommandError>::into)?;
    Ok(domain.into())
}

#[tauri::command]
pub(crate) async fn save_background_startup_preferences(
    state: State<'_, AppState>,
    input: BackgroundStartupPreferencesInput,
) -> Result<(), CommandError> {
    let repository = state.settings_repository();
    repository
        .save_background_startup_preferences(input.into())
        .await
        .map_err(Into::into)
}
