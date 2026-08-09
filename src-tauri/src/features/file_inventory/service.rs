use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::sync::mpsc;
use uuid::Uuid;

use super::directory::LocalDirectoryLister;
use super::error::FileInventoryError;
use super::model::{
    InventoryPage, InventoryQuery, InventoryWatchedLocation, PersistenceSummary,
    ProjectDirectoryPage, ProjectDirectoryQuery, ScanRun, ScanType,
};
use super::repository::{FileInventoryRepository, SqliteFileInventoryRepository};
use super::scanner::{LocalFileScanner, ScanMessage};
use crate::features::projects::{ProjectService, ResolvedProjectScanTarget};

const SCAN_CHANNEL_CAPACITY: usize = 8;

#[derive(Debug, Clone)]
pub(crate) struct FileInventoryService {
    repository: SqliteFileInventoryRepository,
    project_service: ProjectService,
    scanner: LocalFileScanner,
    directory_lister: LocalDirectoryLister,
    scan_locks: Arc<Mutex<HashMap<Uuid, Arc<tokio::sync::Mutex<()>>>>>,
}

impl FileInventoryService {
    pub(crate) fn new(
        repository: SqliteFileInventoryRepository,
        project_service: ProjectService,
    ) -> Self {
        Self {
            repository,
            project_service,
            scanner: LocalFileScanner,
            directory_lister: LocalDirectoryLister,
            scan_locks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub(crate) async fn query(
        &self,
        query: InventoryQuery,
    ) -> Result<InventoryPage, FileInventoryError> {
        let target = self.project_service.scan_target(query.project_id).await?;
        let mut page = self.repository.query(&query).await?;
        page.watched_locations = target
            .watched_locations
            .into_iter()
            .map(|location| InventoryWatchedLocation {
                id: location.id,
                relative_path: location.relative_path,
            })
            .collect();
        Ok(page)
    }

    pub(crate) async fn list_directory(
        &self,
        query: ProjectDirectoryQuery,
    ) -> Result<ProjectDirectoryPage, FileInventoryError> {
        let target = self
            .project_service
            .resolve_project_directory(query.project_id, &query.relative_path)
            .await?;
        let lister = self.directory_lister;
        tokio::task::spawn_blocking(move || lister.list(target, query.page, query.page_size))
            .await
            .map_err(|_| FileInventoryError::RuntimeUnavailable)?
    }

    pub(crate) async fn reconcile_project(
        &self,
        project_id: Uuid,
        scan_type: ScanType,
    ) -> Result<ScanRun, FileInventoryError> {
        self.reconcile(project_id, None, scan_type).await
    }

    pub(crate) async fn reconcile_watched_location(
        &self,
        project_id: Uuid,
        watched_location_id: Uuid,
    ) -> Result<ScanRun, FileInventoryError> {
        self.reconcile(
            project_id,
            Some(watched_location_id),
            ScanType::ManualLocation,
        )
        .await
    }

    pub(crate) async fn reconcile_all(&self, scan_type: ScanType) -> Vec<ScanRun> {
        let targets = match self.project_service.scan_targets().await {
            Ok(targets) => targets,
            Err(error) => {
                tracing::error!(error = %error, "could not load projects for reconciliation");
                return Vec::new();
            }
        };

        let mut scans = Vec::with_capacity(targets.len());
        for target in targets {
            match self.reconcile(target.id, None, scan_type).await {
                Ok(scan) => scans.push(scan),
                Err(error) => {
                    tracing::warn!(
                        project_id = %target.id,
                        error = %error,
                        "project reconciliation failed"
                    );
                }
            }
        }
        scans
    }

    pub(crate) async fn watch_targets(&self) -> Vec<ResolvedProjectScanTarget> {
        let targets = match self.project_service.scan_targets().await {
            Ok(targets) => targets,
            Err(error) => {
                tracing::error!(error = %error, "could not load project watcher targets");
                return Vec::new();
            }
        };

        targets
            .into_iter()
            .filter_map(
                |target| match self.project_service.resolve_scan_target(&target, None) {
                    Ok(Some(resolved)) => Some(resolved),
                    Ok(None) => None,
                    Err(error) => {
                        tracing::warn!(
                            project_id = %target.id,
                            error = %error,
                            "project watcher target is unavailable"
                        );
                        None
                    }
                },
            )
            .collect()
    }

    async fn reconcile(
        &self,
        project_id: Uuid,
        watched_location_id: Option<Uuid>,
        scan_type: ScanType,
    ) -> Result<ScanRun, FileInventoryError> {
        let project_lock = {
            let mut locks = self
                .scan_locks
                .lock()
                .map_err(|_| FileInventoryError::RuntimeUnavailable)?;
            Arc::clone(
                locks
                    .entry(project_id)
                    .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(()))),
            )
        };
        let _scan_guard = project_lock.lock().await;
        let target = self.project_service.scan_target(project_id).await?;
        if watched_location_id.is_some_and(|requested| {
            !target
                .watched_locations
                .iter()
                .any(|location| location.id == requested)
        }) {
            return Err(FileInventoryError::WatchedLocationNotFound);
        }

        let scan_id = self
            .repository
            .start_scan(project_id, watched_location_id, scan_type)
            .await?;
        let resolved = match self
            .project_service
            .resolve_scan_target(&target, watched_location_id)
        {
            Ok(Some(resolved)) => resolved,
            Ok(None) => return Err(FileInventoryError::WatchedLocationNotFound),
            Err(error) => {
                tracing::warn!(
                    project_id = %project_id,
                    scan_id = %scan_id,
                    error = %error,
                    "project root could not be prepared for scanning"
                );
                return self
                    .repository
                    .fail_scan(scan_id, "The project files were unavailable for this scan.")
                    .await;
            }
        };

        let (sender, mut receiver) = mpsc::channel(SCAN_CHANNEL_CAPACITY);
        let scanner = self.scanner;
        let worker = tokio::task::spawn_blocking(move || scanner.scan(resolved, sender));
        let mut persistence = PersistenceSummary::default();
        let mut traversal = None;

        while let Some(message) = receiver.recv().await {
            match message {
                ScanMessage::Batch(batch) => {
                    let batch_summary = match self
                        .repository
                        .upsert_batch(project_id, scan_id, &batch)
                        .await
                    {
                        Ok(summary) => summary,
                        Err(error) => {
                            drop(receiver);
                            let _ = worker.await;
                            let _ = self
                                .repository
                                .fail_scan(scan_id, "The inventory could not be saved.")
                                .await;
                            return Err(error);
                        }
                    };
                    persistence.files_added += batch_summary.files_added;
                    persistence.files_updated += batch_summary.files_updated;
                    persistence.files_unchanged += batch_summary.files_unchanged;
                }
                ScanMessage::Finished(summary) => {
                    traversal = Some(summary);
                    break;
                }
            }
        }

        if worker.await.is_err() {
            return self
                .repository
                .fail_scan(scan_id, "The scan worker stopped before completing.")
                .await;
        }
        let Some(traversal) = traversal else {
            return self
                .repository
                .fail_scan(scan_id, "The scan worker stopped before completing.")
                .await;
        };
        let scan = match self
            .repository
            .finish_scan(
                scan_id,
                project_id,
                watched_location_id,
                traversal,
                persistence,
            )
            .await
        {
            Ok(scan) => scan,
            Err(error) => {
                let _ = self
                    .repository
                    .fail_scan(scan_id, "The scan result could not be saved.")
                    .await;
                return Err(error);
            }
        };

        tracing::info!(
            project_id = %project_id,
            scan_id = %scan.id,
            scan_type = scan.scan_type.as_str(),
            scan_status = scan.status.as_str(),
            files_discovered = scan.files_discovered,
            files_missing = scan.files_missing,
            "project inventory reconciled"
        );
        Ok(scan)
    }
}
