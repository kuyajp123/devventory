use thiserror::Error;

use crate::features::projects::{ProjectDirectoryError, ProjectError};
use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum FileInventoryError {
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("project directory operation failed")]
    Directory(#[from] ProjectDirectoryError),
    #[error("project directory contains too many entries")]
    DirectoryTooLarge,
    #[error("filesystem operation failed")]
    Filesystem(#[from] std::io::Error),
    #[error("inventory filter is invalid")]
    InvalidFilter,
    #[error("persisted inventory data is invalid")]
    InvalidPersistedData,
    #[error("inventory runtime is unavailable")]
    RuntimeUnavailable,
    #[error("project operation failed")]
    Project(#[from] ProjectError),
    #[error("watched location was not found")]
    WatchedLocationNotFound,
    #[error("watcher operation failed")]
    Watcher(#[from] notify::Error),
}

impl From<FileInventoryError> for CommandError {
    fn from(error: FileInventoryError) -> Self {
        match error {
            FileInventoryError::InvalidFilter => {
                Self::invalid_input("The inventory filters contain invalid data.")
            }
            FileInventoryError::WatchedLocationNotFound => {
                Self::not_found("The requested watched location could not be found.")
            }
            FileInventoryError::Directory(error) => match error {
                ProjectDirectoryError::InvalidRelativePath
                | ProjectDirectoryError::InvalidPathEncoding => {
                    Self::invalid_input("The project-relative directory path is invalid.")
                }
                ProjectDirectoryError::LinkNotAllowed => {
                    Self::invalid_input("Linked directories are not available in the Project Tree.")
                }
                ProjectDirectoryError::NotFound | ProjectDirectoryError::ProjectNotFound => {
                    Self::not_found("The requested project directory could not be found.")
                }
                ProjectDirectoryError::NotDirectory => {
                    Self::invalid_input("The requested project path is not a directory.")
                }
                ProjectDirectoryError::RootUnavailable | ProjectDirectoryError::Unreadable => {
                    Self::filesystem_unavailable(
                        "The requested project directory cannot be read. Check its permissions.",
                    )
                }
            },
            FileInventoryError::DirectoryTooLarge => {
                Self::invalid_input("This directory contains too many entries to display safely.")
            }
            FileInventoryError::Project(project_error) => project_error.into(),
            FileInventoryError::Filesystem(_) | FileInventoryError::Watcher(_) => {
                Self::filesystem_unavailable(
                    "The project files are temporarily unavailable. Try another scan.",
                )
            }
            FileInventoryError::Database(_)
            | FileInventoryError::InvalidPersistedData
            | FileInventoryError::RuntimeUnavailable => Self::storage_unavailable(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::FileInventoryError;
    use crate::shared::errors::command::CommandError;

    #[test]
    fn command_errors_are_typed_and_never_expose_filesystem_details() {
        let invalid = CommandError::from(FileInventoryError::InvalidFilter);
        assert_eq!(invalid.code(), "INVALID_INPUT");

        let secret = "C:/private/.env contains SECRET_TOKEN";
        let filesystem = CommandError::from(FileInventoryError::Filesystem(std::io::Error::other(
            secret,
        )));
        let serialized = serde_json::to_string(&filesystem).expect("serialized command error");
        assert_eq!(filesystem.code(), "FILESYSTEM_UNAVAILABLE");
        assert!(!serialized.contains(secret));
        assert!(!serialized.contains("SECRET_TOKEN"));
    }
}
