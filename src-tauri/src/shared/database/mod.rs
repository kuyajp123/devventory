mod backup;
mod connection;
mod migrations;

use std::path::{Path, PathBuf};

use sqlx::SqlitePool;

use crate::shared::errors::AppError;

use backup::create_pre_migration_snapshot;
pub(crate) use backup::BackupSnapshot;
use connection::connect;
use migrations::{applied_versions, latest_version, run as run_migrations};

#[cfg(test)]
mod tests;

const DATABASE_FILE_NAME: &str = "devventory.sqlite3";
const BACKUPS_DIRECTORY_NAME: &str = "backups";

#[derive(Debug, Clone)]
pub(crate) struct DatabasePaths {
    data_directory: PathBuf,
    database_file: PathBuf,
    backups_directory: PathBuf,
}

impl DatabasePaths {
    pub(crate) fn new(data_directory: impl AsRef<Path>) -> Self {
        let data_directory = data_directory.as_ref().to_path_buf();

        Self {
            database_file: data_directory.join(DATABASE_FILE_NAME),
            backups_directory: data_directory.join(BACKUPS_DIRECTORY_NAME),
            data_directory,
        }
    }

    pub(crate) fn data_directory(&self) -> &Path {
        &self.data_directory
    }

    pub(crate) fn database_file(&self) -> &Path {
        &self.database_file
    }

    pub(crate) fn backups_directory(&self) -> &Path {
        &self.backups_directory
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Database {
    pool: SqlitePool,
}

impl Database {
    pub(crate) fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    #[cfg(test)]
    pub(crate) async fn close(self) {
        self.pool.close().await;
    }
}

#[derive(Debug)]
pub(crate) struct DatabaseInitialization {
    pub(crate) database: Database,
    pub(crate) pre_migration_backup: Option<BackupSnapshot>,
}

pub(crate) async fn initialize_database(
    paths: &DatabasePaths,
) -> Result<DatabaseInitialization, AppError> {
    let database_preexisted =
        paths.database_file().is_file() && std::fs::metadata(paths.database_file())?.len() > 0;

    std::fs::create_dir_all(paths.data_directory())?;

    let pool = connect(paths.database_file()).await?;
    let applied = applied_versions(&pool).await?;
    let target_version = latest_version();
    let current_version = applied.iter().copied().max().unwrap_or(0);
    let has_pending_migrations = migrations::has_pending(&applied);

    let pre_migration_backup = if database_preexisted && has_pending_migrations {
        Some(
            create_pre_migration_snapshot(
                &pool,
                paths.backups_directory(),
                current_version,
                target_version,
            )
            .await?,
        )
    } else {
        None
    };

    run_migrations(&pool).await?;

    Ok(DatabaseInitialization {
        database: Database { pool },
        pre_migration_backup,
    })
}
