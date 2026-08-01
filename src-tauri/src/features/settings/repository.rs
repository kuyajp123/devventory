use sqlx::{query_as, FromRow, SqlitePool};
use uuid::Uuid;

use crate::shared::errors::AppError;

const MAX_SETTING_KEY_LENGTH: usize = 128;

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
