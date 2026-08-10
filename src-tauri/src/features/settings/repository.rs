use sqlx::{query, query_as, FromRow, SqlitePool};
use uuid::Uuid;

use super::model::{BackgroundStartupPreferences, NotificationPreferences};
use crate::shared::errors::AppError;

const MAX_SETTING_KEY_LENGTH: usize = 128;

pub(crate) const NOTIFICATIONS_ENABLED_KEY: &str = "settings.notifications.enabled";
pub(crate) const NOTIFICATIONS_IN_APP_ENABLED_KEY: &str = "settings.notifications.in_app_enabled";
pub(crate) const NOTIFICATIONS_SYSTEM_ENABLED_KEY: &str = "settings.notifications.system_enabled";

pub(crate) const BACKGROUND_KEEP_RUNNING_KEY: &str = "settings.background.keep_running_when_closed";
pub(crate) const BACKGROUND_START_WITH_WINDOWS_KEY: &str = "settings.background.start_with_windows";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ApplicationSetting {
    pub(crate) id: Uuid,
    pub(crate) key: String,
    pub(crate) value: String,
}

#[derive(FromRow)]
struct ApplicationSettingRow {
    id: String,
    key: String,
    value: String,
}

impl TryFrom<ApplicationSettingRow> for ApplicationSetting {
    type Error = AppError;

    fn try_from(row: ApplicationSettingRow) -> Result<Self, Self::Error> {
        let id = Uuid::parse_str(&row.id)
            .map_err(|_| AppError::InvalidPersistedData("setting id is not a UUID"))?;

        Ok(Self {
            id,
            key: row.key,
            value: row.value,
        })
    }
}

#[allow(async_fn_in_trait)]
pub(crate) trait SettingsRepository: Send + Sync {
    async fn find_by_key(&self, key: &str) -> Result<Option<ApplicationSetting>, AppError>;
    async fn upsert(&self, key: &str, value: &str) -> Result<ApplicationSetting, AppError>;
    async fn get_notification_preferences(&self) -> Result<NotificationPreferences, AppError>;
    async fn save_notification_preferences(
        &self,
        prefs: NotificationPreferences,
    ) -> Result<(), AppError>;
    async fn get_background_startup_preferences(
        &self,
    ) -> Result<BackgroundStartupPreferences, AppError>;
    async fn save_background_startup_preferences(
        &self,
        prefs: BackgroundStartupPreferences,
    ) -> Result<(), AppError>;
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteSettingsRepository {
    pool: SqlitePool,
}

impl SqliteSettingsRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl SettingsRepository for SqliteSettingsRepository {
    async fn find_by_key(&self, key: &str) -> Result<Option<ApplicationSetting>, AppError> {
        validate_key(key)?;

        let row = query_as::<_, ApplicationSettingRow>(
            "SELECT id, setting_key AS key, setting_value AS value
             FROM application_settings
             WHERE setting_key = ?",
        )
        .bind(key)
        .fetch_optional(&self.pool)
        .await?;

        row.map(TryInto::try_into).transpose()
    }

    async fn upsert(&self, key: &str, value: &str) -> Result<ApplicationSetting, AppError> {
        validate_key(key)?;

        query(
            "INSERT INTO application_settings (id, setting_key, setting_value)
             VALUES (?, ?, ?)
             ON CONFLICT(setting_key) DO UPDATE SET
                 setting_value = excluded.setting_value,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await?;

        self.find_by_key(key)
            .await?
            .ok_or(AppError::InvalidPersistedData(
                "setting upsert did not return a row",
            ))
    }

    async fn get_notification_preferences(&self) -> Result<NotificationPreferences, AppError> {
        let defaults = NotificationPreferences::default();
        let enabled = self
            .find_by_key(NOTIFICATIONS_ENABLED_KEY)
            .await?
            .map(|s| s.value == "true")
            .unwrap_or(defaults.enabled);
        let in_app_enabled = self
            .find_by_key(NOTIFICATIONS_IN_APP_ENABLED_KEY)
            .await?
            .map(|s| s.value == "true")
            .unwrap_or(defaults.in_app_enabled);
        let system_enabled = self
            .find_by_key(NOTIFICATIONS_SYSTEM_ENABLED_KEY)
            .await?
            .map(|s| s.value == "true")
            .unwrap_or(defaults.system_enabled);

        Ok(NotificationPreferences {
            enabled,
            in_app_enabled,
            system_enabled,
        })
    }

    async fn save_notification_preferences(
        &self,
        prefs: NotificationPreferences,
    ) -> Result<(), AppError> {
        self.upsert(
            NOTIFICATIONS_ENABLED_KEY,
            if prefs.enabled { "true" } else { "false" },
        )
        .await?;
        self.upsert(
            NOTIFICATIONS_IN_APP_ENABLED_KEY,
            if prefs.in_app_enabled { "true" } else { "false" },
        )
        .await?;
        self.upsert(
            NOTIFICATIONS_SYSTEM_ENABLED_KEY,
            if prefs.system_enabled { "true" } else { "false" },
        )
        .await?;
        Ok(())
    }

    async fn get_background_startup_preferences(
        &self,
    ) -> Result<BackgroundStartupPreferences, AppError> {
        let defaults = BackgroundStartupPreferences::default();
        let keep_running_when_closed = self
            .find_by_key(BACKGROUND_KEEP_RUNNING_KEY)
            .await?
            .map(|s| s.value == "true")
            .unwrap_or(defaults.keep_running_when_closed);
        let start_with_windows = self
            .find_by_key(BACKGROUND_START_WITH_WINDOWS_KEY)
            .await?
            .map(|s| s.value == "true")
            .unwrap_or(defaults.start_with_windows);

        Ok(BackgroundStartupPreferences {
            keep_running_when_closed,
            start_with_windows,
        })
    }

    async fn save_background_startup_preferences(
        &self,
        prefs: BackgroundStartupPreferences,
    ) -> Result<(), AppError> {
        self.upsert(
            BACKGROUND_KEEP_RUNNING_KEY,
            if prefs.keep_running_when_closed {
                "true"
            } else {
                "false"
            },
        )
        .await?;
        self.upsert(
            BACKGROUND_START_WITH_WINDOWS_KEY,
            if prefs.start_with_windows {
                "true"
            } else {
                "false"
            },
        )
        .await?;
        Ok(())
    }
}

fn validate_key(key: &str) -> Result<(), AppError> {
    if key.trim().is_empty() {
        return Err(AppError::InvalidInput("setting key must not be empty"));
    }

    if key.len() > MAX_SETTING_KEY_LENGTH {
        return Err(AppError::InvalidInput("setting key is too long"));
    }

    Ok(())
}
