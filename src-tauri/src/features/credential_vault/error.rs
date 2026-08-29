use thiserror::Error;

use crate::features::projects::ProjectFileError;
use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum CredentialVaultError {
    #[error("credential source was not found")]
    SourceNotFound,
    #[error("credential was not found")]
    CredentialNotFound,
    #[error("credential key already exists in this source")]
    DuplicateCredential,
    #[error("credential vault is locked")]
    Locked,
    #[error("credential vault password is incorrect")]
    IncorrectPassword,
    #[error("credential vault request is invalid")]
    InvalidInput,
    #[error("credential source icon is invalid")]
    InvalidIcon,
    #[error("persisted credential vault data is invalid")]
    InvalidPersistedData,
    #[error("credential vault storage is unavailable")]
    SecretStorage,
    #[error("project file access failed")]
    ProjectFile(#[from] ProjectFileError),
    #[error("environment file parse failed: {0}")]
    EnvParse(String),
    #[error("duplicate active keys in environment file: {0}")]
    DuplicateActiveKeys(String),
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("filesystem operation failed")]
    Filesystem(#[from] std::io::Error),
}

impl From<CredentialVaultError> for CommandError {
    fn from(error: CredentialVaultError) -> Self {
        match error {
            CredentialVaultError::SourceNotFound => {
                Self::not_found("The requested credential source could not be found.")
            }
            CredentialVaultError::CredentialNotFound => {
                Self::not_found("The requested credential could not be found.")
            }
            CredentialVaultError::DuplicateCredential => Self::environment_conflict(
                "That key already exists in the selected credential source.",
            ),
            CredentialVaultError::DuplicateActiveKeys(_) => Self::invalid_input(
                "The environment file contains duplicate active keys. Remove or comment out duplicates before importing.",
            ),
            CredentialVaultError::Locked => {
                Self::operation_unavailable("Unlock Credential Vault before accessing credentials.")
            }
            CredentialVaultError::IncorrectPassword => Self::credential_vault_password_incorrect(
                "The master password is incorrect. Devventory cannot recover it.",
            ),
            CredentialVaultError::InvalidInput => {
                Self::invalid_input("The credential vault request contains invalid data.")
            }
            CredentialVaultError::InvalidIcon => {
                Self::invalid_input("Choose a PNG, JPEG, or WebP image no larger than 2 MB.")
            }
            CredentialVaultError::EnvParse(_) => {
                Self::invalid_input("The environment file contains invalid formatting or encoding.")
            }
            CredentialVaultError::ProjectFile(error) => match error {
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
                        "The configuration source cannot be read. Check the file permissions.",
                    )
                }
                ProjectFileError::InvalidPathEncoding => {
                    Self::invalid_input("The configuration source path is not supported.")
                }
            },
            CredentialVaultError::Database(ref err) => {
                tracing::error!(error = ?err, "database error in credential vault");
                Self::storage_unavailable()
            }
            CredentialVaultError::Filesystem(ref err) => {
                tracing::error!(error = ?err, "filesystem error in credential vault");
                Self::storage_unavailable()
            }
            CredentialVaultError::InvalidPersistedData => {
                tracing::error!("invalid persisted data in credential vault");
                Self::storage_unavailable()
            }
            CredentialVaultError::SecretStorage => {
                tracing::error!("secret storage (stronghold) error in credential vault");
                Self::storage_unavailable()
            }
        }
    }
}
