use thiserror::Error;

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
            CredentialVaultError::Database(_)
            | CredentialVaultError::Filesystem(_)
            | CredentialVaultError::InvalidPersistedData
            | CredentialVaultError::SecretStorage => Self::storage_unavailable(),
        }
    }
}
