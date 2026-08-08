use std::path::Path;

use tauri::AppHandle;

use crate::features::asset_library::{AssetService, LocalAssetFilesystem, SqliteAssetRepository};
use crate::features::backups::repository::{
    BackupRecordDraft, BackupRepository, SqliteBackupRepository,
};
use crate::features::environment_tracker::{EnvironmentService, SqliteEnvironmentRepository};
use crate::features::file_inventory::{
    FileInventoryService, InventoryRuntime, SqliteFileInventoryRepository,
};
use crate::features::projects::{LocalProjectFilesystem, ProjectService, SqliteProjectRepository};
use crate::features::settings::repository::{SettingsRepository, SqliteSettingsRepository};
use crate::features::validation_center::{
    LocalManifestFilesystem, SqliteValidationRepository, ValidationService,
};
use crate::shared::database::{initialize_database, Database, DatabasePaths};
use crate::shared::errors::AppError;

#[derive(Debug)]
pub(crate) struct AppState {
    database: Database,
    file_inventory_service: FileInventoryService,
    asset_service: AssetService,
    environment_service: EnvironmentService,
    validation_service: ValidationService,
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
        let asset_service = AssetService::new(
            SqliteAssetRepository::new(database.pool().clone()),
            ProjectService::new(
                SqliteProjectRepository::new(database.pool().clone()),
                LocalProjectFilesystem,
            ),
            LocalAssetFilesystem,
        );
        let environment_service = EnvironmentService::new(
            SqliteEnvironmentRepository::new(database.pool().clone()),
            ProjectService::new(
                SqliteProjectRepository::new(database.pool().clone()),
                LocalProjectFilesystem,
            ),
        );
        let validation_service = ValidationService::new(
            SqliteValidationRepository::new(database.pool().clone()),
            ProjectService::new(
                SqliteProjectRepository::new(database.pool().clone()),
                LocalProjectFilesystem,
            ),
            file_inventory_service.clone(),
            LocalManifestFilesystem,
        );

        Ok(Self {
            database,
            asset_service,
            environment_service,
            validation_service,
            file_inventory_service,
            inventory_runtime: InventoryRuntime::new(),
        })
    }

    pub(crate) async fn verify_storage(&self) -> Result<(), AppError> {
        let _ = self
            .settings_repository()
            .find_by_key("system.health-check")
            .await?;

        Ok(())
    }

    pub(crate) fn project_service(&self) -> ProjectService {
        ProjectService::new(
            SqliteProjectRepository::new(self.database.pool().clone()),
            LocalProjectFilesystem,
        )
    }

    pub(crate) fn settings_repository(&self) -> SqliteSettingsRepository {
        SqliteSettingsRepository::new(self.database.pool().clone())
    }

    pub(crate) fn file_inventory_service(&self) -> FileInventoryService {
        self.file_inventory_service.clone()
    }

    pub(crate) fn asset_service(&self) -> AssetService {
        self.asset_service.clone()
    }

    pub(crate) fn environment_service(&self) -> EnvironmentService {
        self.environment_service.clone()
    }

    pub(crate) fn validation_service(&self) -> ValidationService {
        self.validation_service.clone()
    }

    pub(crate) async fn start_inventory_runtime(
        &self,
        app: AppHandle,
    ) -> Result<(), crate::features::file_inventory::FileInventoryError> {
        self.refresh_inventory_watchers().await?;
        self.inventory_runtime
            .start(
                app,
                self.file_inventory_service(),
                self.environment_service(),
                self.validation_service(),
            )
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
