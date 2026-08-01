use uuid::Uuid;

use super::error::ProjectError;
use super::filesystem::LocalProjectFilesystem;
use super::model::{
    CreateProject, InitialScanSummary, NewProjectRecord, Project, ScanConfiguration,
};
use super::repository::{ProjectRepository, SqliteProjectRepository};

const MAX_DESCRIPTION_LENGTH: usize = 2_000;
const MAX_PROJECT_NAME_LENGTH: usize = 120;

#[derive(Debug, Clone)]
pub(crate) struct ProjectService {
    repository: SqliteProjectRepository,
    filesystem: LocalProjectFilesystem,
}

impl ProjectService {
    pub(crate) fn new(
        repository: SqliteProjectRepository,
        filesystem: LocalProjectFilesystem,
    ) -> Self {
        Self {
            repository,
            filesystem,
        }
    }

    pub(crate) fn validate_root(&self, root_path: &str) -> Result<String, ProjectError> {
        self.filesystem.validate_root(root_path)
    }

    pub(crate) fn preview_scan(
        &self,
        configuration: ScanConfiguration,
    ) -> Result<InitialScanSummary, ProjectError> {
        let validated = self.filesystem.validate_configuration(
            &configuration.root_path,
            &configuration.watched_locations,
            &configuration.exclusions,
        )?;
        Ok(self.filesystem.scan(&validated))
    }

    pub(crate) async fn create(&self, input: CreateProject) -> Result<Project, ProjectError> {
        let name = input.name.trim().to_owned();
        if name.is_empty() || name.chars().count() > MAX_PROJECT_NAME_LENGTH {
            return Err(ProjectError::InvalidProjectName);
        }
        let description = input
            .description
            .map(|description| description.trim().to_owned())
            .filter(|description| !description.is_empty());
        if description
            .as_ref()
            .is_some_and(|description| description.chars().count() > MAX_DESCRIPTION_LENGTH)
        {
            return Err(ProjectError::DescriptionTooLong);
        }

        let validated = self.filesystem.validate_configuration(
            &input.root_path,
            &input.watched_locations,
            &input.exclusions,
        )?;
        if self
            .repository
            .exists_by_root_key(&validated.root_path_key)
            .await?
        {
            return Err(ProjectError::DuplicateRoot);
        }

        let initial_scan = self.filesystem.scan(&validated);
        let record = NewProjectRecord {
            id: Uuid::new_v4(),
            name,
            description,
            project_type: input.project_type,
            root_path: validated.root_path_display,
            root_path_key: validated.root_path_key,
            watched_locations: validated
                .watched_locations
                .into_iter()
                .map(|location| location.relative_path)
                .collect(),
            exclusions: validated.exclusions,
            initial_scan,
        };
        let project = self.repository.create(record).await?;

        tracing::info!(
            project_id = %project.id,
            files_discovered = project.initial_scan.files_discovered,
            scan_completed = project.initial_scan.completed,
            "registered local project"
        );
        Ok(project)
    }

    pub(crate) async fn list(&self) -> Result<Vec<Project>, ProjectError> {
        self.repository.find_all().await
    }

    pub(crate) async fn get(&self, id: &str) -> Result<Project, ProjectError> {
        let id = Uuid::parse_str(id).map_err(|_| ProjectError::InvalidProjectId)?;
        self.repository
            .find_by_id(id)
            .await?
            .ok_or(ProjectError::ProjectNotFound)
    }
}
