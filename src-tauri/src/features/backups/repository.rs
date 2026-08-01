use std::path::{Component, Path};

use sqlx::{query_as, FromRow, SqlitePool};
use uuid::Uuid;

use crate::shared::errors::AppError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BackupRecordDraft {
    pub(crate) id: Uuid,
    pub(crate) file_name: String,
    pub(crate) from_version: i64,
    pub(crate) to_version: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BackupRecord {
    pub(crate) id: Uuid,
    pub(crate) file_name: String,
    pub(crate) from_version: i64,
    pub(crate) to_version: i64,
}

#[derive(FromRow)]
struct BackupRecordRow {
    id: String,
    file_name: String,
    from_version: i64,
    to_version: i64,
}

impl TryFrom<BackupRecordRow> for BackupRecord {
    type Error = AppError;

    fn try_from(row: BackupRecordRow) -> Result<Self, Self::Error> {
        let id = Uuid::parse_str(&row.id)
            .map_err(|_| AppError::InvalidPersistedData("backup id is not a UUID"))?;

        Ok(Self {
            id,
            file_name: row.file_name,
            from_version: row.from_version,
            to_version: row.to_version,
        })
    }
}

#[allow(async_fn_in_trait)]
pub(crate) trait BackupRepository: Send + Sync {
    async fn record(&self, draft: BackupRecordDraft) -> Result<BackupRecord, AppError>;
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteBackupRepository {
    pool: SqlitePool,
}

impl SqliteBackupRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl BackupRepository for SqliteBackupRepository {
    async fn record(&self, draft: BackupRecordDraft) -> Result<BackupRecord, AppError> {
        validate_draft(&draft)?;

        let row = query_as::<_, BackupRecordRow>(
            "INSERT INTO backup_records (id, file_name, from_version, to_version)
             VALUES (?, ?, ?, ?)
             RETURNING id, file_name, from_version, to_version",
        )
        .bind(draft.id.to_string())
        .bind(draft.file_name)
        .bind(draft.from_version)
        .bind(draft.to_version)
        .fetch_one(&self.pool)
        .await?;

        row.try_into()
    }
}

fn validate_draft(draft: &BackupRecordDraft) -> Result<(), AppError> {
    let file_name = Path::new(&draft.file_name);
    let is_single_normal_component = matches!(
        file_name.components().collect::<Vec<_>>().as_slice(),
        [Component::Normal(_)]
    );

    if draft.file_name.trim().is_empty() || !is_single_normal_component {
        return Err(AppError::InvalidInput(
            "backup file name must be a single file name",
        ));
    }

    if draft.from_version < 0 || draft.to_version <= draft.from_version {
        return Err(AppError::InvalidInput(
            "backup migration versions are invalid",
        ));
    }

    Ok(())
}
