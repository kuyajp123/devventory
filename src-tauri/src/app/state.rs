use std::path::Path;

use tauri::AppHandle;

use crate::features::backups::repository::{
    BackupRecordDraft, BackupRepository, SqliteBackupRepository,
};
use crate::features::file_inventory::{
    FileInventoryService, InventoryRuntime, SqliteFileInventoryRepository,
};
use crate::features::projects::{LocalProjectFilesystem, ProjectService, SqliteProjectRepository};
use crate::features::settings::repository::{SettingsRepository, SqliteSettingsRepository};
use crate::shared::database::{initialize_database, Database, DatabasePaths};
use crate::shared::errors::AppError;

#[derive(Debug)]
pub(crate) struct AppState {
    database: Database,
    file_inventory_service: FileInventoryService,
    inventory_runtime: InventoryRuntime,
}

impl AppState {
    pub(crate) async fn initialize(data_directory: impl AsRef<Path>) -> Result<Self, AppError> {
        let initialization = initialize_database(&DatabasePaths::new(data_directory)).await?;

        if let Some(snapshot) = initialization.pre_migration_backup {
            let file_name = snapshot
                .file_path
                .file_name()
                .and_then(|name| name.to_str())
                .ok_or(AppError::InvalidBackupPath)?
                .to_owned();
            let repository = SqliteBackupRepository::new(initialization.database.pool().clone());

            repository
                .record(BackupRecordDraft {
                    id: snapshot.id,
                    file_name,
                    from_version: snapshot.from_version,
                    to_version: snapshot.to_version,
                })
                .await?;

            tracing::info!(
                backup_id = %snapshot.id,
                from_version = snapshot.from_version,
                to_version = snapshot.to_version,
                "created and verified a pre-migration database backup"
            );
        }

        let database = initialization.database;
        let project_service = ProjectService::new(
            SqliteProjectRepository::new(database.pool().clone()),
            LocalProjectFilesystem,
        );
        let file_inventory_service = FileInventoryService::new(
            SqliteFileInventoryRepository::new(database.pool().clone()),
            project_service,
        );

        Ok(Self {
            database,
            file_inventory_service,
            inventory_runtime: InventoryRuntime::new(),
        })
    }

    pub(crate) async fn verify_storage(&self) -> Result<(), AppError> {
        let repository = SqliteSettingsRepository::new(self.database.pool().clone());
        let _ = repository.find_by_key("system.health-check").await?;

        Ok(())
    }

    pub(crate) fn project_service(&self) -> ProjectService {
        ProjectService::new(
            SqliteProjectRepository::new(self.database.pool().clone()),
            LocalProjectFilesystem,
        )
    }

    pub(crate) fn file_inventory_service(&self) -> FileInventoryService {
        self.file_inventory_service.clone()
    }

    pub(crate) async fn start_inventory_runtime(
        &self,
        app: AppHandle,
    ) -> Result<(), crate::features::file_inventory::FileInventoryError> {
        self.refresh_inventory_watchers().await?;
        self.inventory_runtime
            .start(app, self.file_inventory_service())
            .await
    }

    pub(crate) async fn refresh_inventory_watchers(
        &self,
    ) -> Result<(), crate::features::file_inventory::FileInventoryError> {
        let targets = self.file_inventory_service.watch_targets().await;
        self.inventory_runtime.replace_watchers(targets)
    }

    #[cfg(test)]
    pub(crate) async fn close(self) {
        self.database.close().await;
    }
}

#[cfg(test)]
mod tests;
