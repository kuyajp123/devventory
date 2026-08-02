use thiserror::Error;

use crate::features::projects::ProjectError;
use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum AssetError {
    #[error("asset collision requires a choice")]
    Collision,
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("destination path is invalid")]
    DestinationInvalid,
    #[error("destination is outside the project root")]
    DestinationOutsideRoot,
    #[error("destination contains a symbolic link or junction")]
    DestinationLinkNotAllowed,
    #[error("filesystem operation failed")]
    Filesystem(#[from] std::io::Error),
    #[error("asset filter is invalid")]
    InvalidFilter,
    #[error("destination filename is invalid")]
    InvalidFilename,
    #[error("asset metadata is invalid")]
    InvalidMetadata,
    #[error("persisted asset data is invalid")]
    InvalidPersistedData,
    #[error("asset was not found")]
    NotFound,
    #[error("native action is unavailable")]
    ActionUnavailable,
    #[error("project operation failed")]
    Project(#[from] ProjectError),
    #[error("source file is invalid")]
    SourceInvalid,
}

impl From<AssetError> for CommandError {
    fn from(error: AssetError) -> Self {
        match error {
            AssetError::Collision => Self::asset_conflict(
                "A file already exists at that destination. Choose how to continue.",
            ),
            AssetError::DestinationOutsideRoot | AssetError::DestinationLinkNotAllowed => {
                Self::path_outside_root()
            }
            AssetError::InvalidFilter
            | AssetError::InvalidFilename
            | AssetError::InvalidMetadata
            | AssetError::DestinationInvalid
            | AssetError::SourceInvalid => {
                Self::invalid_input("The asset request contains invalid data.")
            }
            AssetError::NotFound => Self::not_found("The requested asset could not be found."),
            AssetError::ActionUnavailable => {
                Self::operation_unavailable("That file action is unavailable on this device.")
            }
            AssetError::Project(error) => error.into(),
            AssetError::Filesystem(_) => Self::filesystem_unavailable(
                "The file operation could not be completed. Check the file and folder permissions.",
            ),
            AssetError::Database(_) | AssetError::InvalidPersistedData => {
                Self::storage_unavailable()
            }
        }
    }
}
