use serde::{Deserialize, Serialize};

use super::model::{CreateProject, InitialScanSummary, Project, ProjectType, ScanConfiguration};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ValidateProjectRootInput {
    pub(super) root_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ScanProjectRootInput {
    pub(super) root_path: String,
    pub(super) watched_locations: Vec<String>,
    pub(super) exclusions: Vec<String>,
}

impl From<ScanProjectRootInput> for ScanConfiguration {
    fn from(input: ScanProjectRootInput) -> Self {
        Self {
            root_path: input.root_path,
            watched_locations: input.watched_locations,
            exclusions: input.exclusions,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateProjectInput {
    pub(super) name: String,
    pub(super) description: Option<String>,
    pub(super) project_type: ProjectType,
    pub(super) root_path: String,
    pub(super) watched_locations: Vec<String>,
    pub(super) exclusions: Vec<String>,
}

impl From<CreateProjectInput> for CreateProject {
    fn from(input: CreateProjectInput) -> Self {
        Self {
            name: input.name,
            description: input.description,
            project_type: input.project_type,
            root_path: input.root_path,
            watched_locations: input.watched_locations,
            exclusions: input.exclusions,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ValidatedProjectRootDto {
    root_path: String,
}

impl ValidatedProjectRootDto {
    pub(super) fn new(root_path: String) -> Self {
        Self { root_path }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectDto {
    id: String,
    name: String,
    description: Option<String>,
    project_type: ProjectType,
    root_path: String,
    created_at: String,
    updated_at: String,
    watched_locations: Vec<String>,
    exclusions: Vec<String>,
    initial_scan: InitialScanSummary,
}

impl From<Project> for ProjectDto {
    fn from(project: Project) -> Self {
        Self {
            id: project.id.to_string(),
            name: project.name,
            description: project.description,
            project_type: project.project_type,
            root_path: project.root_path,
            created_at: project.created_at,
            updated_at: project.updated_at,
            watched_locations: project.watched_locations,
            exclusions: project.exclusions,
            initial_scan: project.initial_scan,
        }
    }
}
