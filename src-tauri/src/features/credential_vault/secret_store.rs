use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri_plugin_stronghold::kdf::KeyDerivation;
use tauri_plugin_stronghold::stronghold::Stronghold;
use uuid::Uuid;

use super::error::CredentialVaultError;
use super::model::VaultStatus;

const CLIENT_ID: &[u8] = b"devventory-credential-vault";
const SNAPSHOT_FILE_NAME: &str = "credential-vault.hold";
const SALT_FILE_NAME: &str = "credential-vault.salt";

pub(super) struct CredentialSecretStore {
    snapshot_path: PathBuf,
    salt_path: PathBuf,
    session: Mutex<Option<Stronghold>>,
}

impl std::fmt::Debug for CredentialSecretStore {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("CredentialSecretStore")
            .field("snapshot_path", &self.snapshot_path)
            .field("salt_path", &self.salt_path)
            .field("is_unlocked", &self.is_unlocked())
            .finish_non_exhaustive()
    }
}

impl CredentialSecretStore {
    pub(super) fn new(data_directory: &Path) -> Self {
        Self {
            snapshot_path: data_directory.join(SNAPSHOT_FILE_NAME),
            salt_path: data_directory.join(SALT_FILE_NAME),
            session: Mutex::new(None),
        }
    }

    pub(super) fn status(&self) -> VaultStatus {
        VaultStatus {
            is_configured: self.snapshot_path.is_file(),
            is_unlocked: self.is_unlocked(),
        }
    }

    pub(super) fn is_unlocked(&self) -> bool {
        self.session
            .lock()
            .map(|session| session.is_some())
            .unwrap_or(false)
    }

    pub(super) fn unlock(&self, password: &str) -> Result<VaultStatus, CredentialVaultError> {
        let configured = self.snapshot_path.is_file();
        if configured {
            validate_salt(&self.salt_path)?;
        }
        let password_hash =
            std::panic::catch_unwind(|| KeyDerivation::argon2(password, self.salt_path.as_path()))
                .map_err(|_| CredentialVaultError::SecretStorage)?;
        let stronghold = Stronghold::new(&self.snapshot_path, password_hash).map_err(|_| {
            if configured {
                CredentialVaultError::IncorrectPassword
            } else {
                CredentialVaultError::SecretStorage
            }
        })?;

        if configured {
            stronghold
                .load_client(CLIENT_ID)
                .map_err(|_| CredentialVaultError::SecretStorage)?;
        } else {
            stronghold
                .create_client(CLIENT_ID)
                .map_err(|_| CredentialVaultError::SecretStorage)?;
            stronghold
                .save()
                .map_err(|_| CredentialVaultError::SecretStorage)?;
        }

        *self
            .session
            .lock()
            .map_err(|_| CredentialVaultError::SecretStorage)? = Some(stronghold);
        Ok(self.status())
    }

    pub(super) fn lock(&self) -> Result<VaultStatus, CredentialVaultError> {
        *self
            .session
            .lock()
            .map_err(|_| CredentialVaultError::SecretStorage)? = None;
        Ok(self.status())
    }

    pub(super) fn save(&self, reference: Uuid, value: &str) -> Result<(), CredentialVaultError> {
        self.with_unlocked(|stronghold| {
            let client = stronghold
                .get_client(CLIENT_ID)
                .map_err(|_| CredentialVaultError::SecretStorage)?;
            client
                .store()
                .insert(
                    reference.to_string().into_bytes(),
                    value.as_bytes().to_vec(),
                    None,
                )
                .map_err(|_| CredentialVaultError::SecretStorage)?;
            stronghold
                .save()
                .map_err(|_| CredentialVaultError::SecretStorage)
        })
    }

    pub(super) fn read(&self, reference: Uuid) -> Result<String, CredentialVaultError> {
        self.with_unlocked(|stronghold| {
            let client = stronghold
                .get_client(CLIENT_ID)
                .map_err(|_| CredentialVaultError::SecretStorage)?;
            let bytes = client
                .store()
                .get(reference.to_string().as_bytes())
                .map_err(|_| CredentialVaultError::SecretStorage)?
                .ok_or(CredentialVaultError::CredentialNotFound)?;
            String::from_utf8(bytes).map_err(|_| CredentialVaultError::InvalidPersistedData)
        })
    }

    pub(super) fn delete(&self, reference: Uuid) -> Result<(), CredentialVaultError> {
        self.with_unlocked(|stronghold| {
            let client = stronghold
                .get_client(CLIENT_ID)
                .map_err(|_| CredentialVaultError::SecretStorage)?;
            client
                .store()
                .delete(reference.to_string().as_bytes())
                .map_err(|_| CredentialVaultError::SecretStorage)?;
            stronghold
                .save()
                .map_err(|_| CredentialVaultError::SecretStorage)
        })
    }

    fn with_unlocked<T>(
        &self,
        operation: impl FnOnce(&Stronghold) -> Result<T, CredentialVaultError>,
    ) -> Result<T, CredentialVaultError> {
        let session = self
            .session
            .lock()
            .map_err(|_| CredentialVaultError::SecretStorage)?;
        let stronghold = session.as_ref().ok_or(CredentialVaultError::Locked)?;
        operation(stronghold)
    }
}

fn validate_salt(path: &Path) -> Result<(), CredentialVaultError> {
    let metadata = std::fs::metadata(path).map_err(|_| CredentialVaultError::SecretStorage)?;
    if !metadata.is_file() || metadata.len() != 32 {
        return Err(CredentialVaultError::SecretStorage);
    }
    Ok(())
}
