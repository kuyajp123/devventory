use thiserror::Error;

use crate::features::projects::ProjectError;
use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum EnvironmentError {
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("filesystem operation failed")]
    Filesystem(#[from] std::io::Error),
    #[error("project operation failed")]
    Project(#[from] ProjectError),
    #[error("environment input is invalid")]
    InvalidInput,
    #[error("environment name already exists")]
    DuplicateName,
    #[error("environment resource was not found")]
    NotFound,
    #[error("environment source is outside the project root")]
    PathOutsideRoot,
    #[error("environment source is unavailable")]
    SourceUnavailable,
    #[error("environment source encoding is unsupported")]
    UnsupportedEncoding,
    #[error("persisted environment data is invalid")]
    InvalidPersistedData,
}

impl From<EnvironmentError> for CommandError {
    fn from(error: EnvironmentError) -> Self {
        match error {
            EnvironmentError::InvalidInput => {
                Self::invalid_input("The environment request contains invalid data.")
            }
            EnvironmentError::DuplicateName => {
                Self::invalid_input("An environment with that name already exists in this project.")
            }
            EnvironmentError::NotFound => {
                Self::not_found("The requested environment resource could not be found.")
            }
            EnvironmentError::PathOutsideRoot => Self::path_outside_root(),
            EnvironmentError::Project(project_error) => project_error.into(),
            EnvironmentError::SourceUnavailable
            | EnvironmentError::UnsupportedEncoding
            | EnvironmentError::Filesystem(_) => Self::filesystem_unavailable(
                "The environment source is temporarily unavailable or cannot be parsed.",
            ),
            EnvironmentError::Database(_) | EnvironmentError::InvalidPersistedData => {
                Self::storage_unavailable()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::EnvironmentError;
    use crate::shared::errors::command::CommandError;

    #[test]
    fn command_errors_never_expose_source_contents() {
        let secret = "SUPABASE_ANON_KEY=do-not-return";
        let error = CommandError::from(EnvironmentError::Filesystem(std::io::Error::other(secret)));
        let serialized = serde_json::to_string(&error).expect("serialized command error");
        assert_eq!(error.code(), "FILESYSTEM_UNAVAILABLE");
        assert!(!serialized.contains(secret));
        assert!(!serialized.contains("do-not-return"));
    }
}
