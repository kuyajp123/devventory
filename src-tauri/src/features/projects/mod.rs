pub(crate) mod commands;
mod dto;
mod error;
mod exclusions;
mod filesystem;
mod model;
mod repository;
mod service;

pub(crate) use error::{ProjectDirectoryError, ProjectError, ProjectFileError};
pub(crate) use exclusions::is_project_path_excluded;
pub(crate) use filesystem::{is_link_or_reparse_point, LocalProjectFilesystem};
#[cfg(test)]
pub(crate) use model::{CreateProject, ProjectType, ResolvedWatchedLocation};
pub(crate) use model::{
    ResolvedProjectDirectory, ResolvedProjectFile, ResolvedProjectScanTarget,
    WatchedLocationScanTarget,
};
pub(crate) use repository::SqliteProjectRepository;
pub(crate) use service::ProjectService;

#[cfg(test)]
mod tests;
