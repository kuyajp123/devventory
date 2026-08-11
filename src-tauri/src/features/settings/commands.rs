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
    _app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<BackgroundStartupPreferencesDto, CommandError> {
    let repository = state.settings_repository();
    #[allow(unused_mut)]
    let mut domain = repository
        .get_background_startup_preferences()
        .await
        .map_err(Into::<CommandError>::into)?;

    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_autostart::ManagerExt;
        if let Ok(autostart_mgr) = _app.autostart() {
            if let Ok(actual_enabled) = autostart_mgr.is_enabled() {
                if domain.start_with_windows != actual_enabled {
                    tracing::info!(
                        saved = domain.start_with_windows,
                        actual = actual_enabled,
                        "Reconciling background startup preference with OS autostart registration"
                    );
                    domain.start_with_windows = actual_enabled;
                    let _ = repository
                        .save_background_startup_preferences(domain.clone())
                        .await;
                }
            }
        }
    }

    Ok(domain.into())
}

#[tauri::command]
pub(crate) async fn save_background_startup_preferences(
    _app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: BackgroundStartupPreferencesInput,
) -> Result<(), CommandError> {
    let repository = state.settings_repository();
    let current = repository
        .get_background_startup_preferences()
        .await
        .map_err(Into::<CommandError>::into)?;

    let target: super::model::BackgroundStartupPreferences = input.into();

    if current.start_with_windows != target.start_with_windows {
        #[cfg(not(debug_assertions))]
        {
            use tauri_plugin_autostart::ManagerExt;
            let autostart_mgr = _app.autostart().map_err(|err| {
                CommandError::operation_unavailable(format!(
                    "Autostart plugin unavailable: {}",
                    err
                ))
            })?;

            if target.start_with_windows {
                autostart_mgr.enable().map_err(|err| {
                    CommandError::operation_unavailable(format!(
                        "Failed to enable OS autostart: {}",
                        err
                    ))
                })?;

                if let Err(err) = repository
                    .save_background_startup_preferences(target.clone())
                    .await
                {
                    let _ = autostart_mgr.disable();
                    return Err(err.into());
                }
            } else {
                autostart_mgr.disable().map_err(|err| {
                    CommandError::operation_unavailable(format!(
                        "Failed to disable OS autostart: {}",
                        err
                    ))
                })?;

                if let Err(err) = repository
                    .save_background_startup_preferences(target.clone())
                    .await
                {
                    let _ = autostart_mgr.enable();
                    return Err(err.into());
                }
            }
            return Ok(());
        }

        #[cfg(debug_assertions)]
        {
            tracing::info!(
                requested = target.start_with_windows,
                "Debug build: skipping native OS autostart mutation, saving setting in database only"
            );
        }
    }

    repository
        .save_background_startup_preferences(target)
        .await
        .map_err(Into::into)
}
