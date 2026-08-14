use std::path::{Path, PathBuf};
use std::sync::Arc;

use uuid::Uuid;

use super::error::CredentialVaultError;
use super::model::{
    CreateCredentials, Credential, CredentialSource, NewCredentialSource, PreparedCredential,
    UpdateCredential, UpdateCredentialSource, VaultStatus,
};
use super::repository::SqliteCredentialVaultRepository;
use super::secret_store::CredentialSecretStore;

const ICON_DIRECTORY_NAME: &str = "credential-source-icons";
const MAX_ICON_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug)]
pub(crate) struct CredentialVaultService {
    repository: SqliteCredentialVaultRepository,
    secret_store: Arc<CredentialSecretStore>,
    icons_directory: PathBuf,
}

impl CredentialVaultService {
    pub(crate) fn new(repository: SqliteCredentialVaultRepository, data_directory: &Path) -> Self {
        Self {
            repository,
            secret_store: Arc::new(CredentialSecretStore::new(data_directory)),
            icons_directory: data_directory.join(ICON_DIRECTORY_NAME),
        }
    }

    pub(crate) fn status(&self) -> VaultStatus {
        self.secret_store.status()
    }

    pub(crate) async fn unlock(
        &self,
        password: String,
    ) -> Result<VaultStatus, CredentialVaultError> {
        let secret_store = Arc::clone(&self.secret_store);
        tauri::async_runtime::spawn_blocking(move || secret_store.unlock(&password))
            .await
            .map_err(|_| CredentialVaultError::SecretStorage)?
    }

    pub(crate) fn lock(&self) -> Result<VaultStatus, CredentialVaultError> {
        self.secret_store.lock()
    }

    pub(crate) async fn list_sources(&self) -> Result<Vec<CredentialSource>, CredentialVaultError> {
        self.require_unlocked()?;
        self.repository
            .list_sources()
            .await?
            .into_iter()
            .map(|source| {
                let icon_path = source.icon_file_name.as_ref().map(|file_name| {
                    self.icons_directory
                        .join(file_name)
                        .to_string_lossy()
                        .into_owned()
                });
                Ok(CredentialSource {
                    id: source.id,
                    definition_key: source.definition_key,
                    name: source.name,
                    description: source.description,
                    icon_path,
                    project_ids: source.project_ids,
                    credential_count: source.credential_count,
                    created_at: source.created_at,
                    updated_at: source.updated_at,
                })
            })
            .collect()
    }

    pub(crate) async fn create_source(
        &self,
        input: NewCredentialSource,
    ) -> Result<CredentialSource, CredentialVaultError> {
        self.require_unlocked()?;
        let id = Uuid::new_v4();
        let icon_file_name = input
            .icon_source_path
            .as_deref()
            .map(|path| self.copy_icon(Path::new(path)))
            .transpose()?;
        if let Err(error) = self
            .repository
            .create_source(id, &input, icon_file_name.as_deref())
            .await
        {
            self.remove_icon_best_effort(icon_file_name.as_deref());
            return Err(error);
        }
        self.find_source(id).await
    }

    pub(crate) async fn update_source(
        &self,
        input: UpdateCredentialSource,
    ) -> Result<CredentialSource, CredentialVaultError> {
        self.require_unlocked()?;
        let current = self.find_source(input.source_id).await?;
        let old_icon_file_name = current
            .icon_path
            .as_deref()
            .and_then(|path| Path::new(path).file_name())
            .and_then(|value| value.to_str())
            .map(ToOwned::to_owned);
        let new_icon_file_name = input
            .icon_source_path
            .as_deref()
            .map(|path| self.copy_icon(Path::new(path)))
            .transpose()?;
        let replace_icon = input.remove_icon || new_icon_file_name.is_some();
        if let Err(error) = self
            .repository
            .update_source(&input, new_icon_file_name.as_deref(), replace_icon)
            .await
        {
            self.remove_icon_best_effort(new_icon_file_name.as_deref());
            return Err(error);
        }
        if replace_icon {
            self.remove_icon_best_effort(old_icon_file_name.as_deref());
        }
        self.find_source(input.source_id).await
    }

    pub(crate) async fn delete_source(
        &self,
        source_id: Uuid,
    ) -> Result<Vec<Uuid>, CredentialVaultError> {
        self.require_unlocked()?;
        let source = self.find_source(source_id).await?;
        let icon_file_name = source
            .icon_path
            .as_deref()
            .and_then(|path| Path::new(path).file_name())
            .and_then(|value| value.to_str())
            .map(ToOwned::to_owned);
        let credentials = self.repository.list_credentials(Some(source_id)).await?;
        let affected_projects = credentials
            .iter()
            .flat_map(|item| item.project_ids.iter().copied())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        let references = self.repository.delete_source(source_id).await?;
        for reference in references {
            self.secret_store.delete(reference)?;
        }
        self.remove_icon_best_effort(icon_file_name.as_deref());
        Ok(affected_projects)
    }

    pub(crate) async fn list_credentials(
        &self,
        source_id: Option<Uuid>,
    ) -> Result<Vec<Credential>, CredentialVaultError> {
        self.require_unlocked()?;
        self.repository.list_credentials(source_id).await
    }

    pub(crate) async fn create_credentials(
        &self,
        input: CreateCredentials,
    ) -> Result<Vec<Credential>, CredentialVaultError> {
        self.require_unlocked()?;
        let prepared = input
            .credentials
            .into_iter()
            .map(|credential| PreparedCredential {
                id: Uuid::new_v4(),
                secret_reference: credential.value.as_ref().map(|_| Uuid::new_v4()),
                credential,
            })
            .collect::<Vec<_>>();
        let mut saved_references = Vec::new();
        for item in &prepared {
            if let (Some(reference), Some(value)) =
                (item.secret_reference, item.credential.value.as_deref())
            {
                self.secret_store.save(reference, value)?;
                saved_references.push(reference);
            }
        }
        if let Err(error) = self
            .repository
            .create_credentials(input.source_id, &prepared)
            .await
        {
            for reference in saved_references {
                let _ = self.secret_store.delete(reference);
            }
            return Err(error);
        }
        let created_ids = prepared.iter().map(|item| item.id).collect::<Vec<_>>();
        Ok(self
            .repository
            .list_credentials(Some(input.source_id))
            .await?
            .into_iter()
            .filter(|item| created_ids.contains(&item.id))
            .collect())
    }

    pub(crate) async fn update_credential(
        &self,
        input: UpdateCredential,
    ) -> Result<(Credential, Vec<Uuid>), CredentialVaultError> {
        self.require_unlocked()?;
        let credential_id = input.credential_id;
        let previous = self.find_credential(credential_id).await?;
        self.repository.update_credential(&input).await?;
        let updated = self.find_credential(credential_id).await?;
        let affected_projects = previous
            .project_ids
            .iter()
            .chain(&updated.project_ids)
            .copied()
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        Ok((updated, affected_projects))
    }

    pub(crate) async fn replace_secret(
        &self,
        credential_id: Uuid,
        value: &str,
    ) -> Result<(), CredentialVaultError> {
        self.require_unlocked()?;
        let existing = self.repository.secret_reference(credential_id).await?;
        let reference = existing.unwrap_or_else(Uuid::new_v4);
        self.secret_store.save(reference, value)?;
        if existing.is_none() {
            if let Err(error) = self
                .repository
                .set_secret_reference(credential_id, Some(reference))
                .await
            {
                let _ = self.secret_store.delete(reference);
                return Err(error);
            }
        }
        Ok(())
    }

    pub(crate) async fn remove_secret(
        &self,
        credential_id: Uuid,
    ) -> Result<(), CredentialVaultError> {
        self.require_unlocked()?;
        let reference = self
            .repository
            .secret_reference(credential_id)
            .await?
            .ok_or(CredentialVaultError::CredentialNotFound)?;
        self.repository
            .set_secret_reference(credential_id, None)
            .await?;
        self.secret_store.delete(reference)
    }

    pub(crate) async fn reveal_secret(
        &self,
        credential_id: Uuid,
    ) -> Result<String, CredentialVaultError> {
        self.require_unlocked()?;
        let reference = self
            .repository
            .secret_reference(credential_id)
            .await?
            .ok_or(CredentialVaultError::CredentialNotFound)?;
        self.secret_store.read(reference)
    }

    pub(crate) async fn delete_credential(
        &self,
        credential_id: Uuid,
    ) -> Result<Vec<Uuid>, CredentialVaultError> {
        self.require_unlocked()?;
        let credential = self.find_credential(credential_id).await?;
        let reference = self.repository.delete_credential(credential_id).await?;
        if let Some(reference) = reference {
            self.secret_store.delete(reference)?;
        }
        Ok(credential.project_ids)
    }

    fn require_unlocked(&self) -> Result<(), CredentialVaultError> {
        if self.secret_store.is_unlocked() {
            Ok(())
        } else {
            Err(CredentialVaultError::Locked)
        }
    }

    async fn find_source(&self, source_id: Uuid) -> Result<CredentialSource, CredentialVaultError> {
        self.list_sources()
            .await?
            .into_iter()
            .find(|source| source.id == source_id)
            .ok_or(CredentialVaultError::SourceNotFound)
    }

    async fn find_credential(
        &self,
        credential_id: Uuid,
    ) -> Result<Credential, CredentialVaultError> {
        self.repository
            .list_credentials(None)
            .await?
            .into_iter()
            .find(|credential| credential.id == credential_id)
            .ok_or(CredentialVaultError::CredentialNotFound)
    }

    fn copy_icon(&self, source_path: &Path) -> Result<String, CredentialVaultError> {
        let metadata =
            std::fs::metadata(source_path).map_err(|_| CredentialVaultError::InvalidIcon)?;
        if !metadata.is_file() || metadata.len() > MAX_ICON_BYTES {
            return Err(CredentialVaultError::InvalidIcon);
        }
        let bytes = std::fs::read(source_path).map_err(|_| CredentialVaultError::InvalidIcon)?;
        if bytes.len() as u64 > MAX_ICON_BYTES {
            return Err(CredentialVaultError::InvalidIcon);
        }
        let extension = verified_icon_extension(&bytes).ok_or(CredentialVaultError::InvalidIcon)?;
        std::fs::create_dir_all(&self.icons_directory)?;
        let file_name = format!("{}.{}", Uuid::new_v4(), extension);
        std::fs::write(self.icons_directory.join(&file_name), bytes)?;
        Ok(file_name)
    }

    fn remove_icon_best_effort(&self, file_name: Option<&str>) {
        let Some(file_name) = file_name else {
            return;
        };
        if Path::new(file_name)
            .file_name()
            .and_then(|name| name.to_str())
            != Some(file_name)
        {
            return;
        }
        match std::fs::remove_file(self.icons_directory.join(file_name)) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                tracing::warn!(error = %error, "failed to remove an unused credential source icon")
            }
        }
    }
}

fn verified_icon_extension(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("jpg")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icon_validation_uses_file_signature_instead_of_extension() {
        assert_eq!(
            verified_icon_extension(b"\x89PNG\r\n\x1a\nrest"),
            Some("png")
        );
        assert_eq!(verified_icon_extension(b"not an image"), None);
    }
}
