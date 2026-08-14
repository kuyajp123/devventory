use std::io::Read;

use uuid::Uuid;

use crate::features::projects::{ProjectFileError, ProjectService, ResolvedProjectFile};

use super::error::EnvironmentError;
use super::model::{
    CreateEnvironment, CustomEnvironmentSource, Environment, EnvironmentMatrixPage,
    EnvironmentMatrixQuery, EnvironmentSource, EnvironmentSourceCandidatePage,
    EnvironmentSourceCandidateQuery, EnvironmentSourceParseStatus, UpdateEnvironment,
};
use super::parser::{parse_environment_source, SafeParseIssueCode, MAX_ENVIRONMENT_SOURCE_BYTES};
use super::repository::SqliteEnvironmentRepository;

const MAX_ENVIRONMENT_SOURCES: usize = 64;

#[derive(Debug, Clone)]
pub(crate) struct EnvironmentService {
    repository: SqliteEnvironmentRepository,
    project_service: ProjectService,
}

impl EnvironmentService {
    pub(crate) fn new(
        repository: SqliteEnvironmentRepository,
        project_service: ProjectService,
    ) -> Self {
        Self {
            repository,
            project_service,
        }
    }

    pub(crate) async fn list(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<Environment>, EnvironmentError> {
        self.repository.list_environments(project_id).await
    }

    pub(crate) async fn create(
        &self,
        input: CreateEnvironment,
    ) -> Result<Environment, EnvironmentError> {
        self.repository
            .create_environment(
                input.project_id,
                &input.name,
                &normalize_environment_name(&input.name),
                input.description.as_deref(),
            )
            .await
    }

    pub(crate) async fn update(
        &self,
        input: UpdateEnvironment,
    ) -> Result<Environment, EnvironmentError> {
        self.repository
            .update_environment(
                input.project_id,
                input.environment_id,
                &input.name,
                &normalize_environment_name(&input.name),
                input.description.as_deref(),
            )
            .await
    }

    pub(crate) async fn delete(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        self.repository
            .delete_environment(project_id, environment_id)
            .await
    }

    pub(crate) async fn reorder(
        &self,
        project_id: Uuid,
        environment_ids: Vec<Uuid>,
    ) -> Result<(), EnvironmentError> {
        self.repository
            .reorder_environments(project_id, &environment_ids)
            .await
    }

    pub(crate) async fn list_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<Vec<EnvironmentSource>, EnvironmentError> {
        self.repository
            .list_sources(project_id, environment_id)
            .await
    }

    pub(crate) async fn add_source(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        relative_path: String,
    ) -> Result<EnvironmentSource, EnvironmentError> {
        let resolved = self
            .project_service
            .resolve_regular_project_file(project_id, &relative_path)
            .await?;
        let existing_sources = self
            .repository
            .list_sources(project_id, environment_id)
            .await?;
        if existing_sources.len() >= MAX_ENVIRONMENT_SOURCES {
            return Err(EnvironmentError::InvalidInput);
        }
        let source = self
            .repository
            .create_source(project_id, environment_id, &resolved.relative_path)
            .await?;
        self.parse_resolved_source(&source, resolved).await?;
        Ok(source)
    }

    pub(crate) async fn delete_source(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        source_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        self.repository
            .delete_source(project_id, environment_id, source_id)
            .await
    }

    pub(crate) async fn reorder_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        source_ids: Vec<Uuid>,
    ) -> Result<(), EnvironmentError> {
        self.repository
            .reorder_sources(project_id, environment_id, &source_ids)
            .await
    }

    pub(crate) async fn list_custom_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<Vec<CustomEnvironmentSource>, EnvironmentError> {
        self.repository
            .list_custom_sources(project_id, environment_id)
            .await
    }

    pub(crate) async fn source_candidates(
        &self,
        query: EnvironmentSourceCandidateQuery,
    ) -> Result<EnvironmentSourceCandidatePage, EnvironmentError> {
        self.repository.source_candidates(&query).await
    }

    #[cfg(test)]
    pub(crate) async fn matrix(
        &self,
        query: EnvironmentMatrixQuery,
    ) -> Result<EnvironmentMatrixPage, EnvironmentError> {
        self.repository.matrix(&query, &[]).await
    }

    pub(crate) async fn matrix_with_rule_keys(
        &self,
        query: EnvironmentMatrixQuery,
        rule_keys: &[super::model::EnvironmentMatrixRuleKey],
    ) -> Result<EnvironmentMatrixPage, EnvironmentError> {
        self.repository.matrix(&query, rule_keys).await
    }

    pub(crate) async fn refresh_environment(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        for source in self
            .repository
            .list_sources(project_id, environment_id)
            .await?
        {
            self.refresh_source(source, true).await?;
        }
        Ok(())
    }

    pub(crate) async fn refresh_project_sources(
        &self,
        project_id: Uuid,
        force: bool,
    ) -> Result<usize, EnvironmentError> {
        let sources = self.repository.sources_for_project(project_id).await?;
        let mut refreshed = 0;
        for source in sources {
            if self.refresh_source(source, force).await? {
                refreshed += 1;
            }
        }
        Ok(refreshed)
    }

    async fn refresh_source(
        &self,
        source: EnvironmentSource,
        force: bool,
    ) -> Result<bool, EnvironmentError> {
        let resolved = match self
            .project_service
            .resolve_regular_project_file(source.project_id, &source.relative_path)
            .await
        {
            Ok(resolved) => resolved,
            Err(ProjectFileError::NotFound) => {
                self.repository
                    .persist_source_issue(
                        &source,
                        EnvironmentSourceParseStatus::Missing,
                        None,
                        None,
                        None,
                    )
                    .await?;
                return Ok(true);
            }
            Err(ProjectFileError::RootUnavailable | ProjectFileError::Unreadable) => {
                self.repository
                    .persist_source_issue(
                        &source,
                        EnvironmentSourceParseStatus::Unreadable,
                        None,
                        None,
                        None,
                    )
                    .await?;
                return Ok(true);
            }
            Err(_) => {
                self.repository
                    .persist_source_issue(
                        &source,
                        EnvironmentSourceParseStatus::Unreadable,
                        None,
                        None,
                        None,
                    )
                    .await?;
                return Ok(true);
            }
        };
        if !force
            && source.last_observed_size_bytes == Some(resolved.size_bytes)
            && source.last_observed_modified_at_ms == resolved.modified_at_ms
        {
            return Ok(false);
        }
        self.parse_resolved_source(&source, resolved).await?;
        Ok(true)
    }

    async fn parse_resolved_source(
        &self,
        source: &EnvironmentSource,
        resolved: ResolvedProjectFile,
    ) -> Result<(), EnvironmentError> {
        let path = resolved.absolute_path.clone();
        let bytes = tauri::async_runtime::spawn_blocking(move || read_bounded_source(&path))
            .await
            .map_err(|_| EnvironmentError::SourceUnreadable)?
            .map_err(|_| EnvironmentError::SourceUnreadable)?;
        match parse_environment_source(&bytes) {
            Ok(parsed) => {
                self.repository
                    .persist_parsed_source(
                        source,
                        resolved.size_bytes,
                        resolved.modified_at_ms,
                        parsed,
                    )
                    .await
            }
            Err(issue) => {
                let status = if issue.code == SafeParseIssueCode::InvalidEncoding {
                    EnvironmentSourceParseStatus::UnsupportedEncoding
                } else {
                    EnvironmentSourceParseStatus::ParseIssue
                };
                self.repository
                    .persist_source_issue(
                        source,
                        status,
                        Some(resolved.size_bytes),
                        resolved.modified_at_ms,
                        Some(&issue),
                    )
                    .await
            }
        }
    }
}

fn normalize_environment_name(name: &str) -> String {
    name.trim().to_ascii_lowercase()
}

fn read_bounded_source(path: &std::path::Path) -> Result<Vec<u8>, std::io::Error> {
    let mut reader = std::fs::File::open(path)?.take((MAX_ENVIRONMENT_SOURCE_BYTES + 1) as u64);
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes)?;
    Ok(bytes)
}
