use std::io;

use thiserror::Error;

use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum ProjectError {
    #[error("project description is too long")]
    DescriptionTooLong,
    #[error("project root is already registered")]
    DuplicateRoot,
    #[error("an exclusion is invalid")]
    InvalidExclusion,
    #[error("persisted project data is invalid")]
    InvalidPersistedData,
    #[error("project name is invalid")]
    InvalidProjectName,
    #[error("project identifier is invalid")]
    InvalidProjectId,
    #[error("project root path is not absolute")]
    RootNotAbsolute,
    #[error("project root does not exist")]
    RootNotFound,
    #[error("project root is not a directory")]
    RootNotDirectory,
    #[error("project root cannot be read")]
    RootNotReadable,
    #[error("project root path cannot be represented safely")]
    RootPathEncoding,
    #[error("project was not found")]
    ProjectNotFound,
    #[error("too many exclusions")]
    TooManyExclusions,
    #[error("too many watched locations")]
    TooManyWatchedLocations,
    #[error("project type is unsupported")]
    UnsupportedProjectType,
    #[error("watched location does not exist")]
    WatchedLocationNotFound,
    #[error("watched location is not a directory")]
    WatchedLocationNotDirectory,
    #[error("watched location is outside the project root")]
    WatchedLocationOutsideRoot,
    #[error("watched location cannot be read")]
    WatchedLocationUnreadable,
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("filesystem operation failed")]
    Filesystem(#[from] io::Error),
}

impl From<ProjectError> for CommandError {
    fn from(error: ProjectError) -> Self {
        match error {
            ProjectError::DuplicateRoot => Self::project_root_conflict(),
            ProjectError::ProjectNotFound | ProjectError::InvalidProjectId => {
                Self::not_found("The requested project could not be found.")
            }
            ProjectError::RootNotFound => Self::root_not_found(),
            ProjectError::RootNotDirectory => Self::root_not_directory(),
            ProjectError::RootNotReadable => Self::filesystem_unavailable(
                "The selected project folder cannot be read. Check its permissions.",
            ),
            ProjectError::WatchedLocationNotFound => {
                Self::watched_location_invalid("A watched location does not exist.")
            }
            ProjectError::WatchedLocationNotDirectory => {
                Self::watched_location_invalid("Every watched location must be a folder.")
            }
            ProjectError::WatchedLocationUnreadable => Self::filesystem_unavailable(
                "A watched location cannot be read. Check its permissions.",
            ),
            ProjectError::WatchedLocationOutsideRoot => Self::path_outside_root(),
            ProjectError::RootNotAbsolute
            | ProjectError::RootPathEncoding
            | ProjectError::InvalidExclusion
            | ProjectError::TooManyExclusions
            | ProjectError::TooManyWatchedLocations
            | ProjectError::InvalidProjectName
            | ProjectError::DescriptionTooLong
            | ProjectError::UnsupportedProjectType => {
                Self::invalid_input("The project configuration contains invalid data.")
            }
            ProjectError::Database(_)
            | ProjectError::Filesystem(_)
            | ProjectError::InvalidPersistedData => Self::storage_unavailable(),
        }
    }
}
