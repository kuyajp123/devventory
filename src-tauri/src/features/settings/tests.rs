use tempfile::TempDir;

use super::dto::{BackgroundStartupPreferencesInput, NotificationPreferencesInput};
use super::model::{BackgroundStartupPreferences, NotificationPreferences};
use super::repository::{
    SettingsRepository, SqliteSettingsRepository, BACKGROUND_KEEP_RUNNING_KEY,
    BACKGROUND_START_WITH_WINDOWS_KEY, NOTIFICATIONS_ENABLED_KEY, NOTIFICATIONS_IN_APP_ENABLED_KEY,
    NOTIFICATIONS_SYSTEM_ENABLED_KEY,
};
use crate::shared::database::{initialize_database, DatabasePaths};

async fn setup_test_repository() -> (SqliteSettingsRepository, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let paths = DatabasePaths::new(temp_dir.path());
    let init = initialize_database(&paths).await.unwrap();
    (
        SqliteSettingsRepository::new(init.database.pool().clone()),
        temp_dir,
    )
}

#[tokio::test]
async fn get_notification_preferences_returns_canonical_defaults_when_empty() {
    let (repository, _temp) = setup_test_repository().await;

    let prefs = repository.get_notification_preferences().await.unwrap();
    assert_eq!(prefs, NotificationPreferences::default());
    assert!(prefs.enabled);
    assert!(prefs.in_app_enabled);
    assert!(!prefs.system_enabled);
}

#[tokio::test]
async fn save_and_get_notification_preferences_persists_atomic_keys() {
    let (repository, _temp) = setup_test_repository().await;

    let new_prefs = NotificationPreferences {
        enabled: false,
        in_app_enabled: true,
        system_enabled: true,
    };
    repository
        .save_notification_preferences(new_prefs.clone())
        .await
        .unwrap();

    let fetched = repository.get_notification_preferences().await.unwrap();
    assert_eq!(fetched, new_prefs);

    let enabled_setting = repository
        .find_by_key(NOTIFICATIONS_ENABLED_KEY)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(enabled_setting.value, "false");

    let in_app_setting = repository
        .find_by_key(NOTIFICATIONS_IN_APP_ENABLED_KEY)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(in_app_setting.value, "true");

    let system_setting = repository
        .find_by_key(NOTIFICATIONS_SYSTEM_ENABLED_KEY)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(system_setting.value, "true");
}

#[tokio::test]
async fn get_background_startup_preferences_returns_canonical_defaults_when_empty() {
    let (repository, _temp) = setup_test_repository().await;

    let prefs = repository
        .get_background_startup_preferences()
        .await
        .unwrap();
    assert_eq!(prefs, BackgroundStartupPreferences::default());
    assert!(prefs.keep_running_when_closed);
    assert!(!prefs.start_with_windows);
}

#[tokio::test]
async fn save_and_get_background_startup_preferences_persists_atomic_keys() {
    let (repository, _temp) = setup_test_repository().await;

    let new_prefs = BackgroundStartupPreferences {
        keep_running_when_closed: false,
        start_with_windows: true,
    };
    repository
        .save_background_startup_preferences(new_prefs.clone())
        .await
        .unwrap();

    let fetched = repository
        .get_background_startup_preferences()
        .await
        .unwrap();
    assert_eq!(fetched, new_prefs);

    let keep_running_setting = repository
        .find_by_key(BACKGROUND_KEEP_RUNNING_KEY)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(keep_running_setting.value, "false");

    let start_windows_setting = repository
        .find_by_key(BACKGROUND_START_WITH_WINDOWS_KEY)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(start_windows_setting.value, "true");
}

#[test]
fn dto_conversions_preserve_fields() {
    let input_notif = NotificationPreferencesInput {
        enabled: true,
        in_app_enabled: false,
        system_enabled: true,
    };
    let domain_notif: NotificationPreferences = input_notif.into();
    assert!(domain_notif.enabled);
    assert!(!domain_notif.in_app_enabled);
    assert!(domain_notif.system_enabled);

    let input_bg = BackgroundStartupPreferencesInput {
        keep_running_when_closed: false,
        start_with_windows: true,
    };
    let domain_bg: BackgroundStartupPreferences = input_bg.into();
    assert!(!domain_bg.keep_running_when_closed);
    assert!(domain_bg.start_with_windows);
}
