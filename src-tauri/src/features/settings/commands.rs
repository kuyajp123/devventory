use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::app::state::AppState;
use crate::shared::errors::command::CommandError;

use super::dto::{
    BackgroundStartupPreferencesDto, BackgroundStartupPreferencesInput, NotificationPreferencesDto,
    NotificationPreferencesInput,
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
    app: AppHandle,
    state: State<'_, AppState>,
    input: NotificationPreferencesInput,
) -> Result<(), CommandError> {
    let repository = state.settings_repository();
    let preferences: super::model::NotificationPreferences = input.into();
    repository
        .save_notification_preferences(preferences.clone())
        .await
        .map_err(Into::<CommandError>::into)?;

    crate::app::notification_session::set_session_unread_enabled(
        &app,
        preferences.allows_session_unread(),
    );
    Ok(())
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
        if let Ok(autostart_mgr) = _app.autostart() {
            if let Ok(actual_enabled) = autostart_mgr.is_enabled().await {
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
            let autostart_mgr = _app.autostart().map_err(|_err| {
                CommandError::operation_unavailable("Autostart plugin unavailable")
            })?;

            if target.start_with_windows {
                autostart_mgr.enable().await.map_err(|_err| {
                    CommandError::operation_unavailable("Failed to enable OS autostart")
                })?;

                if let Err(err) = repository
                    .save_background_startup_preferences(target.clone())
                    .await
                {
                    let _ = autostart_mgr.disable().await;
                    return Err(err.into());
                }
            } else {
                autostart_mgr.disable().await.map_err(|_err| {
                    CommandError::operation_unavailable("Failed to disable OS autostart")
                })?;

                if let Err(err) = repository
                    .save_background_startup_preferences(target.clone())
                    .await
                {
                    let _ = autostart_mgr.enable().await;
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
