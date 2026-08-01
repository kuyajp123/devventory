use std::path::{Path, PathBuf};

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{query, query_scalar, SqlitePool};
use uuid::Uuid;

use crate::shared::errors::AppError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BackupSnapshot {
    pub(crate) id: Uuid,
    pub(crate) file_path: PathBuf,
    pub(crate) from_version: i64,
    pub(crate) to_version: i64,
}

pub(super) async fn create_pre_migration_snapshot(
    pool: &SqlitePool,
    backups_directory: &Path,
    from_version: i64,
    to_version: i64,
) -> Result<BackupSnapshot, AppError> {
    std::fs::create_dir_all(backups_directory)?;

    let id = Uuid::new_v4();
    let file_name = format!("pre-migration-v{from_version}-to-v{to_version}-{id}.sqlite3");
    let file_path = backups_directory.join(file_name);
    let sqlite_path = file_path
        .to_str()
        .ok_or(AppError::InvalidBackupPath)?
        .to_owned();

    if let Err(error) = query("VACUUM INTO ?").bind(sqlite_path).execute(pool).await {
        remove_incomplete_snapshot(&file_path);
        return Err(error.into());
    }

    if let Err(error) = verify_snapshot(&file_path).await {
        remove_incomplete_snapshot(&file_path);
        return Err(error);
    }

    Ok(BackupSnapshot {
        id,
        file_path,
        from_version,
        to_version,
    })
}

async fn verify_snapshot(file_path: &Path) -> Result<(), AppError> {
    let options = SqliteConnectOptions::new()
        .filename(file_path)
        .read_only(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;

    let integrity: String = query_scalar("PRAGMA integrity_check")
        .fetch_one(&pool)
        .await?;
    pool.close().await;

    if integrity == "ok" {
        Ok(())
    } else {
        Err(AppError::BackupVerification)
    }
}

fn remove_incomplete_snapshot(file_path: &Path) {
    if file_path.is_file() {
        let _ = std::fs::remove_file(file_path);
    }
}
