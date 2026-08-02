use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use uuid::Uuid;

use crate::features::file_inventory::{categorize_path, path_extension, path_mime_type};
use crate::features::projects::ProjectService;

use super::error::AssetError;
use super::filesystem::{portable_path, LocalAssetFilesystem};
use super::model::{
    ActionTarget, Asset, AssetMetadataUpdate, AssetPage, AssetPreview, AssetQuery, CollisionChoice,
    DuplicateMatch, ImportAsset, ImportResult, ImportStatus, ImportedFileRecord, SourceFile,
};
use super::repository::{AssetRepository, SqliteAssetRepository};

const MAX_NOTE_LENGTH: usize = 10_000;
const MAX_TAGS: usize = 20;
const MAX_TAG_LENGTH: usize = 40;
const MAX_VARIANTS: usize = 20;

#[derive(Debug, Clone)]
pub(crate) struct AssetService {
    repository: SqliteAssetRepository,
    project_service: ProjectService,
    filesystem: LocalAssetFilesystem,
    import_locks: Arc<Mutex<HashMap<Uuid, Arc<tokio::sync::Mutex<()>>>>>,
}

impl AssetService {
    pub(crate) fn new(
        repository: SqliteAssetRepository,
        project_service: ProjectService,
        filesystem: LocalAssetFilesystem,
    ) -> Self {
        Self {
            repository,
            project_service,
            filesystem,
            import_locks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub(crate) async fn query(&self, query: AssetQuery) -> Result<AssetPage, AssetError> {
        self.project_service.scan_target(query.project_id).await?;
        self.repository.query(&query).await
    }

    pub(crate) async fn get(&self, project_id: Uuid, asset_id: Uuid) -> Result<Asset, AssetError> {
        self.repository
            .find(project_id, asset_id)
            .await?
            .ok_or(AssetError::NotFound)
    }

    pub(crate) async fn preview(
        &self,
        project_id: Uuid,
        source_path: String,
    ) -> Result<AssetPreview, AssetError> {
        let source = self.preview_source(source_path).await?;
        let duplicate = self.find_duplicate_for_source(project_id, &source).await?;
        Ok(AssetPreview {
            name: source.name.clone(),
            extension: path_extension(&source.canonical_path),
            mime_type: path_mime_type(&source.canonical_path),
            size_bytes: source.size_bytes,
            category: categorize_path(&source.canonical_path),
            duplicate,
        })
    }

    pub(crate) async fn import(&self, mut input: ImportAsset) -> Result<ImportResult, AssetError> {
        input.tags = normalize_tags(input.tags)?;
        input.note = normalize_note(input.note)?;
        if matches!(input.collision, CollisionChoice::Rename) && input.filename.is_none() {
            return Err(AssetError::InvalidFilename);
        }
        let project_lock = self.project_lock(input.project_id)?;
        let _guard = project_lock.lock().await;
        let started = Instant::now();
        let source = self.preview_source(input.source_path.clone()).await?;
        let target = self.project_service.scan_target(input.project_id).await?;
        let resolved_project = self
            .project_service
            .resolve_scan_target(&target, None)?
            .ok_or(AssetError::DestinationInvalid)?;
        let filename = input.filename.as_deref().unwrap_or(&source.name);
        let destination =
            self.filesystem
                .resolve_destination(&resolved_project, &input.destination, filename)?;
        let requested_path = destination.directory.join(&destination.filename);
        if requested_path.exists() && matches!(input.collision, CollisionChoice::Cancel) {
            return Ok(ImportResult {
                status: ImportStatus::Cancelled,
                asset: None,
                duplicate: None,
            });
        }
        if requested_path.exists() && matches!(input.collision, CollisionChoice::Rename) {
            return Err(AssetError::Collision);
        }
        let final_path = if matches!(input.collision, CollisionChoice::KeepBoth) {
            self.filesystem.keep_both_path(&requested_path)?
        } else {
            requested_path
        };
        let final_filename = final_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or(AssetError::InvalidFilename)?
            .to_owned();
        let import_id = Uuid::new_v4();
        let filesystem = self.filesystem;
        let source_path = source.canonical_path.clone();
        let destination_directory = destination.directory.clone();
        let destination_root = resolved_project.root_path.clone();
        let prepared = tokio::task::spawn_blocking(move || {
            filesystem.validate_destination_directory(&destination_root, &destination_directory)?;
            filesystem.prepare_copy(&source_path, &destination_directory, import_id)
        })
        .await
        .map_err(|_| AssetError::Filesystem(std::io::Error::other("copy worker stopped")))??;
        if prepared.bytes_copied != source.size_bytes {
            self.filesystem.cleanup_temp(&prepared);
            return Err(AssetError::Filesystem(std::io::Error::other(
                "source changed while importing",
            )));
        }
        let hash = prepared.content_hash.clone();
        let relative_path = portable_path(&destination.relative_directory, &final_filename);
        let duplicate = match self
            .find_duplicate_for_hash(
                input.project_id,
                prepared.bytes_copied,
                &hash,
                Some(&relative_path),
            )
            .await
        {
            Ok(duplicate) => duplicate,
            Err(error) => {
                self.filesystem.cleanup_temp(&prepared);
                return Err(error);
            }
        };
        if let Err(error) = self
            .filesystem
            .validate_destination_directory(&resolved_project.root_path, &destination.directory)
        {
            self.filesystem.cleanup_temp(&prepared);
            return Err(error);
        }
        let installed = if matches!(input.collision, CollisionChoice::Replace) {
            self.filesystem
                .install_replace(prepared, final_path.clone(), import_id)?
        } else {
            self.filesystem.install_new(prepared, final_path.clone())?
        };
        let metadata = match std::fs::metadata(&final_path) {
            Ok(metadata) => metadata,
            Err(error) => {
                self.filesystem.rollback(&installed);
                return Err(error.into());
            }
        };
        let record = ImportedFileRecord {
            project_id: input.project_id,
            watched_location_id: destination.watched_location_id,
            relative_path: relative_path.clone(),
            name: final_filename,
            extension: path_extension(&final_path),
            mime_type: path_mime_type(&final_path),
            size_bytes: metadata.len(),
            modified_at_ms: modified_at_ms(&metadata),
            category: categorize_path(&final_path),
            content_hash: hash,
            tags: input.tags,
            note: input.note,
            favorite: input.favorite,
        };
        let asset = match self.repository.persist_import(record).await {
            Ok(asset) => asset,
            Err(error) => {
                self.filesystem.rollback(&installed);
                return Err(error);
            }
        };
        self.filesystem.commit(&installed);
        tracing::info!(
            import_id = %import_id,
            project_id = %input.project_id,
            relative_path,
            size_bytes = asset.size_bytes,
            duration_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
            duplicate = duplicate.is_some(),
            "imported managed asset"
        );
        Ok(ImportResult {
            status: ImportStatus::Imported,
            asset: Some(asset),
            duplicate,
        })
    }

    pub(crate) async fn update_metadata(
        &self,
        mut update: AssetMetadataUpdate,
    ) -> Result<Asset, AssetError> {
        update.tags = normalize_tags(update.tags)?;
        update.note = normalize_note(update.note)?;
        if update.variant_ids.len() > MAX_VARIANTS || update.variant_ids.contains(&update.asset_id)
        {
            return Err(AssetError::InvalidMetadata);
        }
        let unique = update.variant_ids.iter().copied().collect::<HashSet<_>>();
        if unique.len() != update.variant_ids.len() {
            return Err(AssetError::InvalidMetadata);
        }
        self.repository.update_metadata(update).await
    }

    pub(crate) async fn action_target(
        &self,
        project_id: Uuid,
        asset_id: Uuid,
    ) -> Result<ActionTarget, AssetError> {
        let asset = self.get(project_id, asset_id).await?;
        let target = self.project_service.scan_target(project_id).await?;
        let resolved = self
            .project_service
            .resolve_scan_target(&target, None)?
            .ok_or(AssetError::NotFound)?;
        let filesystem = self.filesystem;
        let root = resolved.root_path;
        let relative = asset.relative_path.clone();
        let absolute_path =
            tokio::task::spawn_blocking(move || filesystem.validate_action_path(&root, &relative))
                .await
                .map_err(|_| {
                    AssetError::Filesystem(std::io::Error::other("action worker stopped"))
                })??;
        Ok(ActionTarget {
            absolute_path,
            relative_path: asset.relative_path,
        })
    }

    #[cfg(test)]
    pub(super) fn fail_next_persist(&self) {
        self.repository.fail_next_persist();
    }

    fn project_lock(&self, project_id: Uuid) -> Result<Arc<tokio::sync::Mutex<()>>, AssetError> {
        let mut locks = self.import_locks.lock().map_err(|_| {
            AssetError::Filesystem(std::io::Error::other("import lock unavailable"))
        })?;
        Ok(Arc::clone(
            locks
                .entry(project_id)
                .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(()))),
        ))
    }

    async fn preview_source(&self, source_path: String) -> Result<SourceFile, AssetError> {
        let filesystem = self.filesystem;
        tokio::task::spawn_blocking(move || filesystem.preview_source(&source_path))
            .await
            .map_err(|_| AssetError::Filesystem(std::io::Error::other("preview worker stopped")))?
    }

    async fn find_duplicate_for_source(
        &self,
        project_id: Uuid,
        source: &SourceFile,
    ) -> Result<Option<DuplicateMatch>, AssetError> {
        let filesystem = self.filesystem;
        let source_path = source.canonical_path.clone();
        let source_hash = tokio::task::spawn_blocking(move || filesystem.hash_file(&source_path))
            .await
            .map_err(|_| AssetError::Filesystem(std::io::Error::other("hash worker stopped")))??;
        self.find_duplicate_for_hash(project_id, source.size_bytes, &source_hash, None)
            .await
    }

    async fn find_duplicate_for_hash(
        &self,
        project_id: Uuid,
        size_bytes: u64,
        expected_hash: &str,
        excluded_relative_path: Option<&str>,
    ) -> Result<Option<DuplicateMatch>, AssetError> {
        let candidates = self
            .repository
            .same_size_candidates(project_id, size_bytes)
            .await?;
        if candidates.is_empty() {
            return Ok(None);
        }
        let target = self.project_service.scan_target(project_id).await?;
        let resolved = self
            .project_service
            .resolve_scan_target(&target, None)?
            .ok_or(AssetError::NotFound)?;
        for candidate in candidates {
            if excluded_relative_path == Some(candidate.relative_path.as_str()) {
                continue;
            }
            let filesystem = self.filesystem;
            let root = resolved.root_path.clone();
            let relative_path = candidate.relative_path.clone();
            let inspected = tokio::task::spawn_blocking(move || {
                filesystem.inspect_action_path(&root, &relative_path)
            })
            .await
            .map_err(|_| {
                AssetError::Filesystem(std::io::Error::other("metadata worker stopped"))
            })?;
            let (path, actual_size, actual_modified_at_ms) = match inspected {
                Ok(inspected) => inspected,
                Err(_) => continue,
            };
            if actual_size != size_bytes {
                continue;
            }
            let cached = candidate.content_hash.clone().filter(|_| {
                candidate.hashed_size_bytes == Some(actual_size)
                    && candidate.hashed_modified_at_ms == actual_modified_at_ms
            });
            let candidate_hash = match cached {
                Some(hash) => hash,
                None => {
                    let filesystem = self.filesystem;
                    let hash = tokio::task::spawn_blocking(move || filesystem.hash_file(&path))
                        .await
                        .map_err(|_| {
                            AssetError::Filesystem(std::io::Error::other("hash worker stopped"))
                        })??;
                    self.repository
                        .cache_hash(
                            candidate.asset_id,
                            &hash,
                            actual_size,
                            actual_modified_at_ms,
                        )
                        .await?;
                    hash
                }
            };
            if candidate_hash == expected_hash {
                return Ok(Some(DuplicateMatch {
                    asset_id: candidate.asset_id,
                    relative_path: candidate.relative_path,
                }));
            }
        }
        Ok(None)
    }
}

fn normalize_tags(tags: Vec<String>) -> Result<Vec<String>, AssetError> {
    if tags.len() > MAX_TAGS {
        return Err(AssetError::InvalidMetadata);
    }
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();
    for tag in tags {
        let tag = tag.trim().to_owned();
        let key = tag.to_lowercase();
        if tag.is_empty()
            || tag.chars().count() > MAX_TAG_LENGTH
            || tag.chars().any(|character| character.is_control())
        {
            return Err(AssetError::InvalidMetadata);
        }
        if seen.insert(key) {
            normalized.push(tag);
        }
    }
    normalized.sort_by_key(|value| value.to_lowercase());
    Ok(normalized)
}

fn normalize_note(note: Option<String>) -> Result<Option<String>, AssetError> {
    let note = note
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if note
        .as_ref()
        .is_some_and(|value| value.chars().count() > MAX_NOTE_LENGTH)
    {
        return Err(AssetError::InvalidMetadata);
    }
    Ok(note)
}

fn modified_at_ms(metadata: &std::fs::Metadata) -> Option<i64> {
    let duration = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?;
    i64::try_from(duration.as_millis()).ok()
}
