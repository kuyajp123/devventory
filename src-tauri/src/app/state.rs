use std::path::Path;

use tauri::AppHandle;

use crate::features::agent_usage::{
    AgentReminderRuntime, AgentUsageService, SqliteAgentUsageRepository,
};
use crate::features::asset_library::{AssetService, LocalAssetFilesystem, SqliteAssetRepository};
use crate::features::backups::repository::{
    BackupRecordDraft, BackupRepository, SqliteBackupRepository,
};
use crate::features::credential_vault::{CredentialVaultService, SqliteCredentialVaultRepository};
use crate::features::dashboard::{DashboardService, SqliteDashboardRepository};
use crate::features::environment_tracker::{
    EnvironmentService, EnvironmentWorkspaceService, SqliteEnvironmentRepository,
};
use crate::features::file_inventory::{
    FileInventoryService, InventoryRuntime, SqliteFileInventoryRepository,
};
use crate::features::projects::{LocalProjectFilesystem, ProjectService, SqliteProjectRepository};
use crate::features::search::{SearchService, SqliteSearchRepository};
use crate::features::settings::repository::{SettingsRepository, SqliteSettingsRepository};
use crate::features::validation_center::{
    LocalManifestFilesystem, SqliteValidationRepository, ValidationService,
};
use crate::shared::database::{initialize_database, Database, DatabasePaths};
use crate::shared::errors::AppError;

use crate::app::lifecycle::ApplicationLifecycleState;
use crate::app::notification_session::NotificationSessionState;
use std::sync::Arc;

#[derive(Debug)]
pub(crate) struct AppState {
    database: Database,
    agent_usage_service: AgentUsageService,
    file_inventory_service: FileInventoryService,
    asset_service: AssetService,
    environment_service: EnvironmentService,
    environment_workspace_service: EnvironmentWorkspaceService,
    credential_vault_service: CredentialVaultService,
    validation_service: ValidationService,
    inventory_runtime: InventoryRuntime,
    agent_reminder_runtime: AgentReminderRuntime,
    notification_session_state: Arc<NotificationSessionState>,
    lifecycle_state: Arc<ApplicationLifecycleState>,
}

impl AppState {
    pub(crate) async fn initialize(
        data_directory: impl AsRef<Path>,
        is_autostart_launch: bool,
    ) -> Result<Self, AppError> {
        let data_directory = data_directory.as_ref().to_path_buf();
        let initialization = initialize_database(&DatabasePaths::new(&data_directory)).await?;

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
        let notification_preferences = SqliteSettingsRepository::new(database.pool().clone())
            .get_notification_preferences()
            .await?;
        let agent_usage_service =
            AgentUsageService::new(SqliteAgentUsageRepository::new(database.pool().clone()));
        let project_service = ProjectService::new(
            SqliteProjectRepository::new(database.pool().clone()),
            LocalProjectFilesystem,
        );
        let file_inventory_service = FileInventoryService::new(
            SqliteFileInventoryRepository::new(database.pool().clone()),
            project_service.clone(),
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
        let environment_workspace_service = EnvironmentWorkspaceService::new(
            environment_service.clone(),
            validation_service.clone(),
        );
        let credential_vault_service = CredentialVaultService::new(
            SqliteCredentialVaultRepository::new(database.pool().clone()),
            project_service.clone(),
            &data_directory,
        );

        Ok(Self {
            database,
            agent_usage_service,
            asset_service,
            environment_service,
            environment_workspace_service,
            credential_vault_service,
            validation_service,
            file_inventory_service,
            inventory_runtime: InventoryRuntime::new(),
            agent_reminder_runtime: AgentReminderRuntime::new(),
            notification_session_state: Arc::new(NotificationSessionState::new(
                notification_preferences.allows_session_unread(),
            )),
            lifecycle_state: Arc::new(ApplicationLifecycleState::new(is_autostart_launch)),
        })
    }

    pub(crate) fn lifecycle_state(&self) -> Arc<ApplicationLifecycleState> {
        self.lifecycle_state.clone()
    }

    pub(crate) fn notification_session_state(&self) -> Arc<NotificationSessionState> {
        self.notification_session_state.clone()
    }

    pub(crate) fn start_agent_reminder_runtime(&self, app: AppHandle) {
        self.agent_reminder_runtime.start(
            app,
            self.agent_usage_service(),
            self.settings_repository(),
        );
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

    pub(crate) fn search_service(&self) -> SearchService {
        SearchService::new(SqliteSearchRepository::new(self.database.pool().clone()))
    }

    pub(crate) fn dashboard_service(&self) -> DashboardService {
        DashboardService::new(SqliteDashboardRepository::new(self.database.pool().clone()))
    }

    pub(crate) fn agent_usage_service(&self) -> AgentUsageService {
        self.agent_usage_service.clone()
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

    pub(crate) fn environment_workspace_service(&self) -> EnvironmentWorkspaceService {
        self.environment_workspace_service.clone()
    }

    pub(crate) fn credential_vault_service(&self) -> &CredentialVaultService {
        &self.credential_vault_service
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
