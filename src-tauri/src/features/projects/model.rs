use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::error::ProjectError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProjectType {
    Web,
    Desktop,
    Mobile,
    Backend,
    Library,
    Monorepo,
    Other,
}

impl ProjectType {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Web => "web",
            Self::Desktop => "desktop",
            Self::Mobile => "mobile",
            Self::Backend => "backend",
            Self::Library => "library",
            Self::Monorepo => "monorepo",
            Self::Other => "other",
        }
    }
}

impl TryFrom<&str> for ProjectType {
    type Error = ProjectError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "web" => Ok(Self::Web),
            "desktop" => Ok(Self::Desktop),
            "mobile" => Ok(Self::Mobile),
            "backend" => Ok(Self::Backend),
            "library" => Ok(Self::Library),
            "monorepo" => Ok(Self::Monorepo),
            "other" => Ok(Self::Other),
            _ => Err(ProjectError::UnsupportedProjectType),
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct CreateProject {
    pub(super) name: String,
    pub(super) description: Option<String>,
    pub(super) project_type: ProjectType,
    pub(super) root_path: String,
    pub(super) watched_locations: Vec<String>,
    pub(super) exclusions: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct ScanConfiguration {
    pub(super) root_path: String,
    pub(super) watched_locations: Vec<String>,
    pub(super) exclusions: Vec<String>,
}

#[derive(Debug, Clone)]
pub(super) struct ValidatedProjectConfiguration {
    pub(super) root_path: PathBuf,
    pub(super) root_path_display: String,
    pub(super) root_path_key: String,
    pub(super) watched_locations: Vec<ValidatedWatchedLocation>,
    pub(super) exclusions: Vec<String>,
}

#[derive(Debug, Clone)]
pub(super) struct ValidatedWatchedLocation {
    pub(super) relative_path: String,
    pub(super) absolute_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InitialScanSummary {
    pub(super) files_discovered: u64,
    pub(super) directories_visited: u64,
    pub(super) entries_excluded: u64,
    pub(super) entries_unreadable: u64,
    pub(super) duration_ms: u64,
    pub(super) completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Project {
    pub(super) id: Uuid,
    pub(super) name: String,
    pub(super) description: Option<String>,
    pub(super) project_type: ProjectType,
    pub(super) root_path: String,
    pub(super) created_at: String,
    pub(super) updated_at: String,
    pub(super) watched_locations: Vec<String>,
    pub(super) exclusions: Vec<String>,
    pub(super) initial_scan: InitialScanSummary,
}

#[derive(Debug)]
pub(super) struct NewProjectRecord {
    pub(super) id: Uuid,
    pub(super) name: String,
    pub(super) description: Option<String>,
    pub(super) project_type: ProjectType,
    pub(super) root_path: String,
    pub(super) root_path_key: String,
    pub(super) watched_locations: Vec<String>,
    pub(super) exclusions: Vec<String>,
    pub(super) initial_scan: InitialScanSummary,
}
