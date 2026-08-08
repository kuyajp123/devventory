use thiserror::Error;

use crate::features::{
    file_inventory::FileInventoryError,
    projects::{ProjectError, ProjectFileError},
};
use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum ValidationError {
    #[error("validation rule already exists")]
    DuplicateRule,
    #[error("validation request is invalid")]
    InvalidInput,
    #[error("persisted validation data is invalid")]
    InvalidPersistedData,
    #[error("validation issue was not found")]
    IssueNotFound,
    #[error("validation rule was not found")]
    RuleNotFound,
    #[error("manifest destination already exists")]
    ManifestConflict,
    #[error("manifest path is invalid")]
    ManifestPathInvalid,
    #[error("validation runtime is unavailable")]
    RuntimeUnavailable,
    #[error("project file access failed")]
    ProjectFile(#[from] ProjectFileError),
    #[error("project access failed")]
    Project(#[from] ProjectError),
    #[error("inventory refresh failed")]
    Inventory(#[from] FileInventoryError),
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("filesystem operation failed")]
    Filesystem(#[from] std::io::Error),
}

impl From<ValidationError> for CommandError {
    fn from(error: ValidationError) -> Self {
        match error {
            ValidationError::DuplicateRule => Self::validation_conflict(
                "A rule of that type already exists for this environment key.",
            ),
            ValidationError::RuleNotFound | ValidationError::IssueNotFound => {
                Self::not_found("The requested validation record could not be found.")
            }
            ValidationError::InvalidInput => {
                Self::invalid_input("The validation request contains invalid data.")
            }
            ValidationError::ManifestConflict => Self::manifest_conflict(),
            ValidationError::ManifestPathInvalid => Self::manifest_path_invalid(),
            ValidationError::ProjectFile(_) | ValidationError::Project(_) => {
                Self::filesystem_unavailable(
                    "The project folder is unavailable. Check its permissions and try again.",
                )
            }
            ValidationError::Inventory(_)
            | ValidationError::RuntimeUnavailable
            | ValidationError::Database(_)
            | ValidationError::Filesystem(_)
            | ValidationError::InvalidPersistedData => Self::storage_unavailable(),
        }
    }
}
