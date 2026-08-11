use thiserror::Error;

use crate::features::projects::ProjectFileError;
use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum EnvironmentError {
    #[error("environment source is already configured")]
    DuplicateSource,
    #[error("custom environment source name is already used")]
    DuplicateCustomSource,
    #[error("custom environment key is already assigned to this source")]
    DuplicateCustomKey,
    #[error("environment name is already used")]
    DuplicateEnvironment,
    #[error("environment request is invalid")]
    InvalidInput,
    #[error("persisted environment data is invalid")]
    InvalidPersistedData,
    #[error("environment was not found")]
    EnvironmentNotFound,
    #[error("environment source was not found")]
    SourceNotFound,
    #[error("custom environment source was not found")]
    CustomSourceNotFound,
    #[error("custom environment key was not found")]
    CustomKeyNotFound,
    #[error("environment source is unreadable")]
    SourceUnreadable,
    #[error("project file access failed")]
    ProjectFile(#[from] ProjectFileError),
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("filesystem operation failed")]
    Filesystem(#[from] std::io::Error),
}

impl From<EnvironmentError> for CommandError {
    fn from(error: EnvironmentError) -> Self {
        match error {
            EnvironmentError::DuplicateEnvironment => {
                Self::environment_conflict("An environment with that name already exists.")
            }
            EnvironmentError::DuplicateSource => Self::environment_conflict(
                "That configuration source is already assigned to this environment.",
            ),
            EnvironmentError::DuplicateCustomSource => Self::environment_conflict(
                "A custom source with that name already exists in the target environment.",
            ),
            EnvironmentError::DuplicateCustomKey => Self::environment_conflict(
                "That custom key already exists in the selected custom source.",
            ),
            EnvironmentError::EnvironmentNotFound
            | EnvironmentError::SourceNotFound
            | EnvironmentError::CustomSourceNotFound
            | EnvironmentError::CustomKeyNotFound => {
                Self::not_found("The requested environment configuration could not be found.")
            }
            EnvironmentError::InvalidInput => {
                Self::invalid_input("The environment request contains invalid data.")
            }
            EnvironmentError::SourceUnreadable => Self::filesystem_unavailable(
                "The configured source cannot be read. Check the file and folder permissions.",
            ),
            EnvironmentError::ProjectFile(error) => match error {
                ProjectFileError::InvalidRelativePath | ProjectFileError::LinkNotAllowed => {
                    Self::path_outside_root()
                }
                ProjectFileError::NotFound => {
                    Self::not_found("The requested configuration source does not exist.")
                }
                ProjectFileError::NotRegularFile => Self::invalid_input(
                    "Configuration sources must be regular files inside the project root.",
                ),
                ProjectFileError::ProjectNotFound => {
                    Self::not_found("The requested project could not be found.")
                }
                ProjectFileError::RootUnavailable | ProjectFileError::Unreadable => {
                    Self::filesystem_unavailable(
                        "The configured source cannot be read. Check the file and folder permissions.",
                    )
                }
                ProjectFileError::InvalidPathEncoding => {
                    Self::invalid_input("The configuration source path is not supported.")
                }
            },
            EnvironmentError::Database(_)
            | EnvironmentError::Filesystem(_)
            | EnvironmentError::InvalidPersistedData => Self::storage_unavailable(),
        }
    }
}
