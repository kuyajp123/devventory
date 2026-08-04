use std::collections::HashSet;
use std::fs::File;
use std::io::BufReader;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use uuid::Uuid;

use crate::features::projects::ProjectService;

use super::error::EnvironmentError;
use super::model::{
    Environment, EnvironmentDraft, EnvironmentSource, EnvironmentUpdate, MatrixPage, MatrixQuery,
    RefreshSummary, SourceCandidatePage, SourceCandidateQuery, SourceDraft, SourceStatus,
};
use super::parser::parse_reader;
use super::repository::SqliteEnvironmentRepository;

const MAX_NAME_LENGTH: usize = 80;
const MAX_DESCRIPTION_LENGTH: usize = 500;
const MAX_ENVIRONMENTS: usize = 100;
const MAX_SOURCES_PER_ENVIRONMENT: usize = 100;
const MAX_RELATIVE_PATH_LENGTH: usize = 1_024;

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
        self.project_service.scan_target(project_id).await?;
        self.repository.list(project_id).await
    }

    pub(crate) async fn create(
        &self,
        project_id: Uuid,
        name: String,
        description: Option<String>,
    ) -> Result<Environment, EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        if self.repository.list(project_id).await?.len() >= MAX_ENVIRONMENTS {
            return Err(EnvironmentError::InvalidInput);
        }
        let (name, normalized_name) = normalize_name(name)?;
        let description = normalize_description(description)?;
        self.repository
            .create(&EnvironmentDraft {
                project_id,
                name,
                normalized_name,
                description,
            })
            .await
    }

    pub(crate) async fn update(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        name: String,
        description: Option<String>,
    ) -> Result<Environment, EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        let (name, normalized_name) = normalize_name(name)?;
        let description = normalize_description(description)?;
        self.repository
            .update(&EnvironmentUpdate {
                project_id,
                environment_id,
                name,
                normalized_name,
                description,
            })
            .await
    }

    pub(crate) async fn delete(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        self.repository.delete(project_id, environment_id).await
    }

    pub(crate) async fn reorder_environments(
        &self,
        project_id: Uuid,
        ordered_ids: Vec<Uuid>,
    ) -> Result<Vec<Environment>, EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        self.repository
            .reorder_environments(project_id, &ordered_ids)
            .await
    }

    pub(crate) async fn source_candidates(
        &self,
        query: SourceCandidateQuery,
    ) -> Result<SourceCandidatePage, EnvironmentError> {
        self.project_service.scan_target(query.project_id).await?;
        self.repository.source_candidates(&query).await
    }

    pub(crate) async fn add_source(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        relative_path: String,
    ) -> Result<EnvironmentSource, EnvironmentError> {
        if self
            .repository
            .sources_for_environment(project_id, environment_id)
            .await?
            .len()
            >= MAX_SOURCES_PER_ENVIRONMENT
        {
            return Err(EnvironmentError::InvalidInput);
        }
        let (relative_path, canonical_path_key, _) = self
            .validate_source_path(project_id, &relative_path, true)
            .await?;
        let source_id = Uuid::new_v4();
        self.repository
            .add_source(&SourceDraft {
                id: source_id,
                project_id,
                environment_id,
                relative_path,
                canonical_path_key,
            })
            .await?;
        let _ = self.refresh_source(project_id, source_id).await?;
        self.repository.get_source(project_id, source_id).await
    }

    pub(crate) async fn remove_source(
        &self,
        project_id: Uuid,
        source_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        self.repository.remove_source(project_id, source_id).await
    }

    pub(crate) async fn reorder_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        ordered_ids: Vec<Uuid>,
    ) -> Result<Vec<EnvironmentSource>, EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        self.repository
            .reorder_sources(project_id, environment_id, &ordered_ids)
            .await
    }

    pub(crate) async fn matrix(&self, query: MatrixQuery) -> Result<MatrixPage, EnvironmentError> {
        self.project_service.scan_target(query.project_id).await?;
        self.repository.matrix(&query).await
    }

    pub(crate) async fn refresh_source(
        &self,
        project_id: Uuid,
        source_id: Uuid,
    ) -> Result<RefreshSummary, EnvironmentError> {
        let source = self.repository.get_source(project_id, source_id).await?;
        let path = match self
            .validate_source_path(project_id, &source.relative_path, false)
            .await
        {
            Ok((_, _, path)) => path,
            Err(EnvironmentError::SourceUnavailable) => {
                self.repository
                    .mark_source_unavailable(project_id, source_id, SourceStatus::Missing)
                    .await?;
                return Ok(unavailable_summary());
            }
            Err(error) => return Err(error),
        };
        let source_for_worker = source.clone();
        let parsed = tokio::task::spawn_blocking(move || parse_path(path))
            .await
            .map_err(|_| EnvironmentError::SourceUnavailable)?;
        match parsed {
            Ok(parsed_file) => {
                let key_count = u32::try_from(parsed_file.parsed.occurrences.len())
                    .map_err(|_| EnvironmentError::InvalidPersistedData)?;
                let issue_count = u32::try_from(parsed_file.parsed.issues.len())
                    .map_err(|_| EnvironmentError::InvalidPersistedData)?;
                self.repository
                    .replace_source_parse(
                        &source_for_worker,
                        &parsed_file.parsed,
                        parsed_file.size_bytes,
                        parsed_file.modified_at_ms,
                    )
                    .await?;
                Ok(RefreshSummary {
                    sources_requested: 1,
                    sources_parsed: 1,
                    sources_unavailable: 0,
                    keys_found: key_count,
                    issues_found: issue_count,
                })
            }
            Err(EnvironmentError::UnsupportedEncoding) => {
                self.repository
                    .mark_source_unavailable(project_id, source_id, SourceStatus::ParseError)
                    .await?;
                Ok(unavailable_summary())
            }
            Err(EnvironmentError::Filesystem(error))
                if error.kind() == std::io::ErrorKind::NotFound =>
            {
                self.repository
                    .mark_source_unavailable(project_id, source_id, SourceStatus::Missing)
                    .await?;
                Ok(unavailable_summary())
            }
            Err(EnvironmentError::Filesystem(_)) | Err(EnvironmentError::SourceUnavailable) => {
                self.repository
                    .mark_source_unavailable(project_id, source_id, SourceStatus::Unreadable)
                    .await?;
                Ok(unavailable_summary())
            }
            Err(error) => Err(error),
        }
    }

    pub(crate) async fn refresh_environment(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<RefreshSummary, EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        let sources = self
            .repository
            .sources_for_environment(project_id, environment_id)
            .await?;
        let mut summary = RefreshSummary {
            sources_requested: 0,
            sources_parsed: 0,
            sources_unavailable: 0,
            keys_found: 0,
            issues_found: 0,
        };
        for source in sources {
            summary.include(self.refresh_source(project_id, source.id).await?);
        }
        Ok(summary)
    }

    pub(crate) async fn refresh_all(
        &self,
        project_id: Uuid,
    ) -> Result<RefreshSummary, EnvironmentError> {
        self.project_service.scan_target(project_id).await?;
        let sources = self.repository.sources_for_project(project_id).await?;
        let mut summary = RefreshSummary {
            sources_requested: 0,
            sources_parsed: 0,
            sources_unavailable: 0,
            keys_found: 0,
            issues_found: 0,
        };
        for source in sources {
            summary.include(self.refresh_source(project_id, source.id).await?);
        }
        Ok(summary)
    }

    pub(crate) async fn refresh_changed_paths(
        &self,
        project_id: Uuid,
        changed_paths: Vec<PathBuf>,
    ) -> Result<Option<RefreshSummary>, EnvironmentError> {
        if changed_paths.is_empty() {
            return self.refresh_all(project_id).await.map(Some);
        }
        let target = self.project_service.scan_target(project_id).await?;
        let resolved = self
            .project_service
            .resolve_scan_target(&target, None)?
            .ok_or(EnvironmentError::SourceUnavailable)?;
        let changed = changed_paths
            .iter()
            .filter_map(|path| path.strip_prefix(&resolved.root_path).ok())
            .filter_map(|path| normalize_relative_path(path.to_string_lossy().as_ref()).ok())
            .map(|path| path.to_ascii_lowercase())
            .collect::<HashSet<_>>();
        if changed.is_empty() {
            return Ok(None);
        }
        let sources = self.repository.sources_for_project(project_id).await?;
        let mut summary = RefreshSummary {
            sources_requested: 0,
            sources_parsed: 0,
            sources_unavailable: 0,
            keys_found: 0,
            issues_found: 0,
        };
        for source in sources {
            if changed.contains(&source.relative_path.to_ascii_lowercase()) {
                summary.include(self.refresh_source(project_id, source.id).await?);
            }
        }
        Ok((summary.sources_requested > 0).then_some(summary))
    }

    async fn validate_source_path(
        &self,
        project_id: Uuid,
        relative_path: &str,
        require_readable: bool,
    ) -> Result<(String, String, PathBuf), EnvironmentError> {
        let relative_path = normalize_relative_path(relative_path)?;
        let target = self.project_service.scan_target(project_id).await?;
        let resolved = self
            .project_service
            .resolve_scan_target(&target, None)?
            .ok_or(EnvironmentError::SourceUnavailable)?;
        let candidate = resolved.root_path.join(Path::new(&relative_path));
        let canonical = match std::fs::canonicalize(&candidate) {
            Ok(path) => path,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound && !require_readable => {
                return Err(EnvironmentError::SourceUnavailable)
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Err(EnvironmentError::SourceUnavailable)
            }
            Err(error) => return Err(error.into()),
        };
        if !canonical.starts_with(&resolved.root_path) {
            return Err(EnvironmentError::PathOutsideRoot);
        }
        let metadata = std::fs::metadata(&canonical)?;
        if !metadata.is_file() {
            return Err(EnvironmentError::InvalidInput);
        }
        if require_readable {
            File::open(&canonical)?;
        }
        Ok((
            relative_path.clone(),
            relative_path.to_ascii_lowercase(),
            canonical,
        ))
    }
}

struct ParsedPath {
    parsed: super::model::ParsedEnvironmentFile,
    size_bytes: u64,
    modified_at_ms: Option<i64>,
}

fn parse_path(path: PathBuf) -> Result<ParsedPath, EnvironmentError> {
    let file = File::open(&path)?;
    let metadata = file.metadata()?;
    let modified_at_ms = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| i64::try_from(duration.as_millis()).ok());
    let parsed = parse_reader(BufReader::new(file))?;
    Ok(ParsedPath {
        parsed,
        size_bytes: metadata.len(),
        modified_at_ms,
    })
}

fn normalize_name(value: String) -> Result<(String, String), EnvironmentError> {
    let name = value.trim().to_owned();
    if name.is_empty() || name.chars().count() > MAX_NAME_LENGTH {
        return Err(EnvironmentError::InvalidInput);
    }
    let normalized = name.to_lowercase();
    Ok((name, normalized))
}

fn normalize_description(value: Option<String>) -> Result<Option<String>, EnvironmentError> {
    let value = value
        .map(|description| description.trim().to_owned())
        .filter(|description| !description.is_empty());
    if value
        .as_ref()
        .is_some_and(|description| description.chars().count() > MAX_DESCRIPTION_LENGTH)
    {
        return Err(EnvironmentError::InvalidInput);
    }
    Ok(value)
}

fn normalize_relative_path(value: &str) -> Result<String, EnvironmentError> {
    let value = value.trim().replace('\\', "/");
    if value.is_empty() || value.chars().count() > MAX_RELATIVE_PATH_LENGTH {
        return Err(EnvironmentError::InvalidInput);
    }
    let path = Path::new(&value);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(EnvironmentError::PathOutsideRoot);
    }
    let normalized = path
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str(),
            Component::CurDir => None,
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/");
    if normalized.is_empty() {
        return Err(EnvironmentError::InvalidInput);
    }
    Ok(normalized)
}

fn unavailable_summary() -> RefreshSummary {
    RefreshSummary {
        sources_requested: 1,
        sources_parsed: 0,
        sources_unavailable: 1,
        keys_found: 0,
        issues_found: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_description, normalize_name, normalize_relative_path};

    #[test]
    fn normalizes_environment_names_and_descriptions() {
        assert_eq!(
            normalize_name("  Production  ".to_owned()).expect("valid name"),
            ("Production".to_owned(), "production".to_owned())
        );
        assert_eq!(
            normalize_description(Some("  Primary deployment  ".to_owned()))
                .expect("valid description")
                .as_deref(),
            Some("Primary deployment")
        );
    }

    #[test]
    fn rejects_path_traversal_absolute_paths_and_empty_paths() {
        assert!(normalize_relative_path("../.env").is_err());
        assert!(normalize_relative_path("C:\\private\\.env").is_err());
        assert!(normalize_relative_path("/.env").is_err());
        assert!(normalize_relative_path("  ").is_err());
        assert_eq!(
            normalize_relative_path(" config\\.env.local ").expect("safe path"),
            "config/.env.local"
        );
    }
}
