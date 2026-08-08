use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Instant,
};

use uuid::Uuid;

use crate::features::{
    file_inventory::{FileInventoryService, ScanType},
    projects::ProjectService,
};

use super::{
    domain::{evaluate, generate_manifest},
    error::ValidationError,
    filesystem::LocalManifestFilesystem,
    model::{
        ManifestCollisionChoice, ManifestExport, ManifestPreview, SaveValidationRule,
        ValidationIssue, ValidationIssuePage, ValidationIssueQuery, ValidationIssueStatus,
        ValidationRule, ValidationRunResult, ValidationSummary,
    },
    repository::SqliteValidationRepository,
};

#[derive(Debug, Clone)]
pub(crate) struct ValidationService {
    repository: SqliteValidationRepository,
    project_service: ProjectService,
    inventory_service: FileInventoryService,
    filesystem: LocalManifestFilesystem,
    validation_locks: Arc<Mutex<HashMap<Uuid, Arc<tokio::sync::Mutex<()>>>>>,
}

impl ValidationService {
    pub(crate) fn new(
        repository: SqliteValidationRepository,
        project_service: ProjectService,
        inventory_service: FileInventoryService,
        filesystem: LocalManifestFilesystem,
    ) -> Self {
        Self {
            repository,
            project_service,
            inventory_service,
            filesystem,
            validation_locks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub(crate) async fn list_rules(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<ValidationRule>, ValidationError> {
        self.repository.list_rules(project_id).await
    }

    pub(crate) async fn save_rule(
        &self,
        input: SaveValidationRule,
    ) -> Result<ValidationRule, ValidationError> {
        let project_id = input.project_id;
        let rule = self.repository.save_rule(input).await?;
        self.revalidate_after_rule_change(project_id).await;
        Ok(rule)
    }

    pub(crate) async fn delete_rule(
        &self,
        project_id: Uuid,
        rule_id: Uuid,
    ) -> Result<(), ValidationError> {
        self.repository.delete_rule(project_id, rule_id).await?;
        self.revalidate_after_rule_change(project_id).await;
        Ok(())
    }

    pub(crate) async fn reorder_rules(
        &self,
        project_id: Uuid,
        rule_ids: Vec<Uuid>,
    ) -> Result<(), ValidationError> {
        self.repository.reorder_rules(project_id, &rule_ids).await
    }

    pub(crate) async fn list_issues(
        &self,
        query: ValidationIssueQuery,
    ) -> Result<ValidationIssuePage, ValidationError> {
        self.repository.list_issues(&query).await
    }

    pub(crate) async fn set_issue_status(
        &self,
        project_id: Uuid,
        issue_id: Uuid,
        status: ValidationIssueStatus,
    ) -> Result<ValidationIssue, ValidationError> {
        self.repository
            .set_issue_status(project_id, issue_id, status)
            .await
    }

    pub(crate) async fn summary(
        &self,
        project_id: Uuid,
    ) -> Result<ValidationSummary, ValidationError> {
        self.repository.summary(project_id).await
    }

    pub(crate) async fn validate(
        &self,
        project_id: Uuid,
    ) -> Result<ValidationRunResult, ValidationError> {
        let project_lock = {
            let mut locks = self
                .validation_locks
                .lock()
                .map_err(|_| ValidationError::RuntimeUnavailable)?;
            Arc::clone(
                locks
                    .entry(project_id)
                    .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(()))),
            )
        };
        let _guard = project_lock.lock().await;
        self.project_service.scan_target(project_id).await?;
        let started_at = Instant::now();
        let snapshot = self.repository.load_snapshot(project_id).await?;
        let evaluation = evaluate(&snapshot);
        let issue_count = u64::try_from(evaluation.issues.len()).unwrap_or(u64::MAX);
        let (issues_resolved, summary) = self
            .repository
            .persist_evaluation(project_id, &evaluation)
            .await?;
        tracing::info!(
            project_id = %project_id,
            health = summary.health.as_str(),
            issues_detected = issue_count,
            issues_resolved,
            duration_ms = u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX),
            "environment metadata validation completed"
        );
        Ok(ValidationRunResult {
            summary,
            issues_detected: issue_count,
            issues_resolved,
        })
    }

    pub(crate) async fn manifest_preview(
        &self,
        project_id: Uuid,
        relative_path: String,
    ) -> Result<ManifestPreview, ValidationError> {
        let target = self.project_service.scan_target(project_id).await?;
        let content = self.manifest_content(project_id).await?;
        let key_count = manifest_key_count(&content);
        let root_path = target.root_path;
        let preview_path = relative_path.clone();
        let filesystem = self.filesystem;
        let exists = tauri::async_runtime::spawn_blocking(move || {
            filesystem.exists(&root_path, &preview_path)
        })
        .await
        .map_err(|_| ValidationError::RuntimeUnavailable)??;
        Ok(ManifestPreview {
            relative_path,
            content,
            key_count,
            exists,
        })
    }

    pub(crate) async fn export_manifest(
        &self,
        project_id: Uuid,
        relative_path: String,
        collision_choice: ManifestCollisionChoice,
    ) -> Result<ExportedManifest, ValidationError> {
        let target = self.project_service.scan_target(project_id).await?;
        let content = self.manifest_content(project_id).await?;
        let key_count = manifest_key_count(&content);
        let root_path = target.root_path;
        let write_path = relative_path.clone();
        let filesystem = self.filesystem;
        let replaced = tauri::async_runtime::spawn_blocking(move || {
            filesystem.write_atomic(&root_path, &write_path, &content, collision_choice)
        })
        .await
        .map_err(|_| ValidationError::RuntimeUnavailable)??;
        let scan = self
            .inventory_service
            .reconcile_project(project_id, ScanType::ManualProject)
            .await?;
        Ok(ExportedManifest {
            manifest: ManifestExport {
                relative_path,
                key_count,
                replaced,
            },
            scan,
        })
    }

    async fn manifest_content(&self, project_id: Uuid) -> Result<String, ValidationError> {
        let definitions = self.repository.manifest_definitions(project_id).await?;
        let rules = self.repository.list_rules(project_id).await?;
        Ok(generate_manifest(definitions, &rules))
    }

    async fn revalidate_after_rule_change(&self, project_id: Uuid) {
        if let Err(error) = self.validate(project_id).await {
            tracing::warn!(
                project_id = %project_id,
                error = %error,
                "validation rule was saved but automatic revalidation failed"
            );
        }
    }
}

pub(crate) struct ExportedManifest {
    pub(crate) manifest: ManifestExport,
    pub(crate) scan: crate::features::file_inventory::ScanRun,
}

fn manifest_key_count(content: &str) -> u64 {
    u64::try_from(content.lines().count()).unwrap_or(u64::MAX)
}
