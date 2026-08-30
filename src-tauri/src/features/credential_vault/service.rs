use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use uuid::Uuid;

use crate::features::projects::{ProjectFileError, ProjectService};

use super::dto::ValidatedImportEnvSecrets;
use super::env_parser::{self, parse_env_content};
use super::error::CredentialVaultError;
use super::model::{
    CreateCredentials, Credential, CredentialEnvironmentLink, CredentialSource,
    EnvSecretPreviewItem, ImportEnvSecretsResult, NewCredential, NewCredentialSource,
    PreparedCredential, UpdateCredential, UpdateCredentialSource, VaultStatus,
};
use super::repository::SqliteCredentialVaultRepository;
use super::secret_store::CredentialSecretStore;

const ICON_DIRECTORY_NAME: &str = "credential-source-icons";
const MAX_ICON_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug)]
pub(crate) struct CredentialVaultService {
    repository: SqliteCredentialVaultRepository,
    project_service: ProjectService,
    secret_store: Arc<CredentialSecretStore>,
    icons_directory: PathBuf,
}

impl CredentialVaultService {
    pub(crate) fn new(
        repository: SqliteCredentialVaultRepository,
        project_service: ProjectService,
        data_directory: &Path,
    ) -> Self {
        Self {
            repository,
            project_service,
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
        self.secret_store.delete_batch(&references)?;
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

        let items_to_save: Vec<(Uuid, &str)> = prepared
            .iter()
            .filter_map(
                |item| match (item.secret_reference, item.credential.value.as_deref()) {
                    (Some(reference), Some(value)) => Some((reference, value)),
                    _ => None,
                },
            )
            .collect();

        let saved_references: Vec<Uuid> = items_to_save.iter().map(|(r, _)| *r).collect();

        self.secret_store.save_batch(&items_to_save)?;

        if let Err(error) = self
            .repository
            .create_credentials(input.source_id, &prepared)
            .await
        {
            let _ = self.secret_store.delete_batch(&saved_references);
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

    pub(crate) async fn preview_env_secrets(
        &self,
        project_id: Uuid,
        relative_path: &str,
    ) -> Result<Vec<EnvSecretPreviewItem>, CredentialVaultError> {
        self.require_unlocked()?;
        let resolved = self
            .project_service
            .resolve_regular_project_file(project_id, relative_path)
            .await?;

        let path = resolved.absolute_path.clone();
        let bytes = tauri::async_runtime::spawn_blocking(move || read_bounded_source(&path))
            .await
            .map_err(|_| CredentialVaultError::ProjectFile(ProjectFileError::Unreadable))?
            .map_err(|_| CredentialVaultError::ProjectFile(ProjectFileError::Unreadable))?;

        let parsed =
            parse_env_content(&bytes).map_err(|e| CredentialVaultError::EnvParse(e.to_string()))?;

        let existing_sources = self.repository.list_sources().await?;
        let existing_credentials = self.repository.list_credentials(None).await?;

        let mut preview_items = Vec::new();
        for entry in parsed.entries {
            let existing = existing_credentials.iter().find(|c| {
                c.normalized_key == entry.normalized_key && c.project_ids.contains(&project_id)
            });

            let existing_source_name = existing.and_then(|c| {
                existing_sources
                    .iter()
                    .find(|s| s.id == c.source_id)
                    .map(|s| s.name.clone())
            });

            preview_items.push(EnvSecretPreviewItem {
                key: entry.key,
                line_number: entry.line_number,
                is_commented: entry.is_commented,
                is_already_in_vault: existing.is_some(),
                existing_source_name,
            });
        }

        Ok(preview_items)
    }

    pub(crate) async fn import_env_file(
        &self,
        input: ValidatedImportEnvSecrets,
    ) -> Result<ImportEnvSecretsResult, CredentialVaultError> {
        self.require_unlocked()?;
        let project_id = input.project_id;
        let resolved = self
            .project_service
            .resolve_regular_project_file(project_id, &input.relative_path)
            .await?;

        let path = resolved.absolute_path.clone();
        let bytes = tauri::async_runtime::spawn_blocking(move || read_bounded_source(&path))
            .await
            .map_err(|_| CredentialVaultError::ProjectFile(ProjectFileError::Unreadable))?
            .map_err(|_| CredentialVaultError::ProjectFile(ProjectFileError::Unreadable))?;

        let parsed =
            parse_env_content(&bytes).map_err(|e| CredentialVaultError::EnvParse(e.to_string()))?;

        let mut active_key_lines: HashMap<String, (String, Vec<u32>)> = HashMap::new();
        for entry in &parsed.entries {
            if !entry.is_commented {
                let item = active_key_lines
                    .entry(entry.normalized_key.clone())
                    .or_insert_with(|| (entry.key.clone(), Vec::new()));
                item.1.push(entry.line_number);
            }
        }

        let mut active_duplicates: Vec<_> = active_key_lines
            .into_values()
            .filter(|(_, lines)| lines.len() > 1)
            .collect();
        if !active_duplicates.is_empty() {
            active_duplicates.sort_by(|a, b| a.0.cmp(&b.0));
            let details: Vec<String> = active_duplicates
                .into_iter()
                .map(|(key, lines)| {
                    format!(
                        "{} (lines {})",
                        key,
                        lines
                            .iter()
                            .map(|l| l.to_string())
                            .collect::<Vec<_>>()
                            .join(", ")
                    )
                })
                .collect();
            return Err(CredentialVaultError::DuplicateActiveKeys(format!(
                "Duplicate active keys found in environment file: {}. Please comment out or remove duplicate keys before importing.",
                details.join(", ")
            )));
        }

        let selected_set: HashSet<String> = input
            .selected_keys
            .iter()
            .map(|k| k.trim().to_ascii_uppercase())
            .collect();

        let mut deduplicated_entries: HashMap<String, env_parser::ParsedEnvEntry> = HashMap::new();
        for entry in parsed.entries {
            if !entry.is_commented && selected_set.contains(&entry.normalized_key) {
                deduplicated_entries.insert(entry.normalized_key.clone(), entry);
            }
        }

        let source_id = if let Some(existing_source_id) = input.source_id {
            let source = self.find_source(existing_source_id).await?;
            if !source.project_ids.contains(&project_id) {
                let mut updated_project_ids = source.project_ids.clone();
                updated_project_ids.push(project_id);
                let update_input = UpdateCredentialSource {
                    source_id: source.id,
                    name: source.name,
                    description: source.description,
                    project_ids: updated_project_ids,
                    icon_source_path: None,
                    remove_icon: false,
                };
                self.repository
                    .update_source(&update_input, None, false)
                    .await?;
            }
            existing_source_id
        } else if let Some(source_name) = input.source_name {
            let existing_sources = self.repository.list_sources().await?;
            if let Some(existing) = existing_sources.into_iter().find(|s| {
                s.name.eq_ignore_ascii_case(&source_name) && s.project_ids.contains(&project_id)
            }) {
                existing.id
            } else {
                let new_source = NewCredentialSource {
                    definition_key: Some("env_file".to_string()),
                    name: source_name,
                    description: Some(format!("Imported from {}", input.relative_path)),
                    project_ids: vec![project_id],
                    icon_source_path: None,
                };
                let created = self.create_source(new_source).await?;
                created.id
            }
        } else {
            return Err(CredentialVaultError::InvalidInput);
        };

        let existing_credentials = self.repository.list_credentials(Some(source_id)).await?;

        let mut imported_count = 0u32;
        let mut updated_count = 0u32;
        let mut new_credentials_to_create = Vec::new();

        for (_key, entry) in deduplicated_entries {
            let existing = existing_credentials
                .iter()
                .find(|c| c.normalized_key == entry.normalized_key);

            if let Some(existing_cred) = existing {
                self.replace_secret(existing_cred.id, &entry.value).await?;
                let mut project_ids = existing_cred.project_ids.clone();
                if !project_ids.contains(&project_id) {
                    project_ids.push(project_id);
                }
                let mut environment_links = existing_cred.environment_links.clone();
                if let Some(env_id) = input.environment_id {
                    if !environment_links
                        .iter()
                        .any(|l| l.project_id == project_id && l.environment_id == env_id)
                    {
                        environment_links.push(CredentialEnvironmentLink {
                            project_id,
                            environment_id: env_id,
                        });
                    }
                }
                let update_cred = UpdateCredential {
                    credential_id: existing_cred.id,
                    key: existing_cred.key.clone(),
                    notes: existing_cred.notes.clone(),
                    project_ids,
                    environment_links,
                };
                self.repository.update_credential(&update_cred).await?;
                updated_count += 1;
            } else {
                let mut environment_links = Vec::new();
                if let Some(env_id) = input.environment_id {
                    environment_links.push(CredentialEnvironmentLink {
                        project_id,
                        environment_id: env_id,
                    });
                }
                new_credentials_to_create.push(NewCredential {
                    key: entry.key,
                    notes: None,
                    value: Some(entry.value),
                    project_ids: vec![project_id],
                    environment_links,
                });
            }
        }

        if !new_credentials_to_create.is_empty() {
            let count = new_credentials_to_create.len() as u32;
            self.create_credentials(CreateCredentials {
                source_id,
                credentials: new_credentials_to_create,
            })
            .await?;
            imported_count += count;
        }

        Ok(ImportEnvSecretsResult {
            source_id,
            imported_count,
            updated_count,
        })
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

fn read_bounded_source(path: &Path) -> Result<Vec<u8>, std::io::Error> {
    let mut reader = std::fs::File::open(path)?.take((env_parser::MAX_ENV_SOURCE_BYTES + 1) as u64);
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes)?;
    Ok(bytes)
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
