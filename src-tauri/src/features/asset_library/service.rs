use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use uuid::Uuid;

use crate::features::file_inventory::{categorize_path, path_extension, path_mime_type};
use crate::features::projects::ProjectService;

use super::error::AssetError;
use super::filesystem::{normalize_relative_file, portable_path, LocalAssetFilesystem};
use super::model::{
    ActionTarget, Asset, AssetMetadataUpdate, AssetPage, AssetPreview, AssetQuery,
    AssetVariantsUpdate, CollisionChoice, DuplicateMatch, ImportAsset, ImportResult, ImportStatus,
    ImportedFileRecord, SourceFile, VariantCandidate, VariantCandidatePage, VariantCandidateQuery,
    VariantCandidateRecord, VariantMatchReasons, VariantPathInput,
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

    pub(crate) async fn variant_candidates(
        &self,
        query: VariantCandidateQuery,
    ) -> Result<VariantCandidatePage, AssetError> {
        let current = self.get(query.project_id, query.asset_id).await?;
        let target = self.project_service.scan_target(query.project_id).await?;
        let current_folder = parent_path(&current.relative_path);
        let asset_root = effective_asset_root(&current.relative_path, &target.watched_locations);
        let records = self
            .repository
            .variant_candidates(&query, &current, &asset_root, &current_folder)
            .await?;
        let total_pages = u32::try_from(records.total_items.div_ceil(u64::from(query.page_size)))
            .map_err(|_| AssetError::InvalidPersistedData)?;
        let items = records
            .items
            .into_iter()
            .map(|record| candidate_from_record(record, &current, &asset_root, &current_folder))
            .collect();
        Ok(VariantCandidatePage {
            items,
            total_items: records.total_items,
            page: query.page,
            page_size: query.page_size,
            total_pages,
            has_more: query.page < total_pages,
            asset_root,
            current_folder,
        })
    }

    pub(crate) async fn variants(
        &self,
        project_id: Uuid,
        asset_id: Uuid,
    ) -> Result<Vec<VariantCandidate>, AssetError> {
        let current = self.get(project_id, asset_id).await?;
        let target = self.project_service.scan_target(project_id).await?;
        let current_folder = parent_path(&current.relative_path);
        let asset_root = effective_asset_root(&current.relative_path, &target.watched_locations);
        Ok(self
            .repository
            .variants_for_asset(project_id, asset_id)
            .await?
            .into_iter()
            .map(|record| candidate_from_record(record, &current, &asset_root, &current_folder))
            .collect())
    }

    pub(crate) async fn resolve_variant_path(
        &self,
        input: VariantPathInput,
    ) -> Result<VariantCandidate, AssetError> {
        let relative_path = normalize_relative_file(&input.relative_path).map_err(|error| {
            if matches!(error, AssetError::DestinationOutsideRoot) {
                AssetError::VariantPathOutsideRoot
            } else {
                AssetError::VariantNotIndexed
            }
        })?;
        let current = self.get(input.project_id, input.asset_id).await?;
        let record = self
            .repository
            .variant_by_relative_path(input.project_id, &relative_path)
            .await?
            .ok_or(AssetError::VariantNotIndexed)?;
        if record.id == input.asset_id {
            return Err(AssetError::VariantSelfReference);
        }
        if input.selected_variant_ids.contains(&record.id) {
            return Err(AssetError::VariantAlreadySelected);
        }
        if record.status != "active" {
            return Err(AssetError::VariantMissing);
        }
        let target = self.project_service.scan_target(input.project_id).await?;
        let resolved = self
            .project_service
            .resolve_scan_target(&target, None)?
            .ok_or(AssetError::VariantMissing)?;
        let filesystem = self.filesystem;
        let root = resolved.root_path;
        let relative_for_worker = relative_path.clone();
        tokio::task::spawn_blocking(move || {
            filesystem.validate_action_path(&root, &relative_for_worker)
        })
        .await
        .map_err(|_| AssetError::VariantMissing)?
        .map_err(|_| AssetError::VariantMissing)?;

        let mut proposed = input.selected_variant_ids;
        proposed.push(record.id);
        self.validate_variant_selection(&current, &proposed).await?;
        let current_folder = parent_path(&current.relative_path);
        let asset_root = effective_asset_root(&current.relative_path, &target.watched_locations);
        Ok(candidate_from_record(
            record,
            &current,
            &asset_root,
            &current_folder,
        ))
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
        let project_lock = self.project_lock(update.project_id)?;
        let _guard = project_lock.lock().await;
        update.tags = normalize_tags(update.tags)?;
        update.note = normalize_note(update.note)?;
        let current = self.get(update.project_id, update.asset_id).await?;
        self.validate_variant_selection(&current, &update.variant_ids)
            .await?;
        self.repository.update_metadata(update).await
    }

    pub(crate) async fn update_variants(
        &self,
        update: AssetVariantsUpdate,
    ) -> Result<Asset, AssetError> {
        let project_lock = self.project_lock(update.project_id)?;
        let _guard = project_lock.lock().await;
        let current = self.get(update.project_id, update.asset_id).await?;
        self.validate_variant_selection(&current, &update.variant_ids)
            .await?;
        self.repository.update_variants(update).await
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

    async fn validate_variant_selection(
        &self,
        current: &Asset,
        variant_ids: &[Uuid],
    ) -> Result<(), AssetError> {
        if variant_ids.len() > MAX_VARIANTS {
            return Err(AssetError::InvalidMetadata);
        }
        if variant_ids.contains(&current.id) {
            return Err(AssetError::VariantSelfReference);
        }
        let unique = variant_ids.iter().copied().collect::<HashSet<_>>();
        if unique.len() != variant_ids.len() {
            return Err(AssetError::VariantAlreadySelected);
        }
        let records = self
            .repository
            .variant_records_by_ids(current.project_id, variant_ids)
            .await?;
        if records.len() != unique.len() {
            return Err(AssetError::VariantNotIndexed);
        }
        let existing = current.variant_ids.iter().copied().collect::<HashSet<_>>();
        if records
            .iter()
            .any(|record| record.status != "active" && !existing.contains(&record.id))
        {
            return Err(AssetError::VariantMissing);
        }

        let mut graph = adjacency_map(
            self.repository
                .relation_edges_excluding(current.project_id, current.id)
                .await?,
        );
        for id in variant_ids.iter().filter(|id| existing.contains(id)) {
            add_edge(&mut graph, current.id, *id);
        }
        for id in variant_ids.iter().filter(|id| !existing.contains(id)) {
            if is_reachable(&graph, current.id, *id) {
                return Err(AssetError::VariantCircular);
            }
            add_edge(&mut graph, current.id, *id);
        }
        Ok(())
    }
}

fn effective_asset_root(
    relative_path: &str,
    watched_locations: &[crate::features::projects::WatchedLocationScanTarget],
) -> String {
    watched_locations
        .iter()
        .map(|location| location.relative_path.as_str())
        .filter(|location| *location != "." && path_is_within(relative_path, location))
        .max_by_key(|location| location.split('/').count())
        .map(ToOwned::to_owned)
        .or_else(|| {
            relative_path
                .split_once('/')
                .map(|(root, _)| root.to_owned())
        })
        .unwrap_or_else(|| ".".to_owned())
}

fn parent_path(relative_path: &str) -> String {
    relative_path
        .rsplit_once('/')
        .map_or_else(|| ".".to_owned(), |(parent, _)| parent.to_owned())
}

fn path_is_within(relative_path: &str, root: &str) -> bool {
    root == "."
        || relative_path == root
        || relative_path
            .strip_prefix(root)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn candidate_from_record(
    record: VariantCandidateRecord,
    current: &Asset,
    asset_root: &str,
    current_folder: &str,
) -> VariantCandidate {
    let current_stem = file_stem(&current.name);
    let candidate_stem = file_stem(&record.name);
    let current_tags = current
        .tags
        .iter()
        .map(|tag| tag.to_lowercase())
        .collect::<HashSet<_>>();
    let reasons = VariantMatchReasons {
        same_folder: parent_path(&record.relative_path) == current_folder,
        same_asset_root: path_is_within(&record.relative_path, asset_root),
        similar_name: current_stem.len() >= 2
            && candidate_stem.len() >= 2
            && (current_stem.contains(&candidate_stem) || candidate_stem.contains(&current_stem)),
        compatible_type: record.category == current.category
            || record.extension.as_deref() == current.extension.as_deref(),
        matching_metadata: record
            .tags
            .iter()
            .any(|tag| current_tags.contains(&tag.to_lowercase())),
    };
    VariantCandidate {
        id: record.id,
        relative_path: record.relative_path,
        name: record.name,
        extension: record.extension,
        category: record.category,
        origin: record.origin,
        status: record.status,
        reasons,
    }
}

fn file_stem(name: &str) -> String {
    name.rsplit_once('.')
        .map_or(name, |(stem, _)| stem)
        .to_lowercase()
}

fn adjacency_map(edges: Vec<(Uuid, Uuid)>) -> HashMap<Uuid, HashSet<Uuid>> {
    let mut graph = HashMap::new();
    for (left, right) in edges {
        add_edge(&mut graph, left, right);
    }
    graph
}

fn add_edge(graph: &mut HashMap<Uuid, HashSet<Uuid>>, left: Uuid, right: Uuid) {
    graph.entry(left).or_default().insert(right);
    graph.entry(right).or_default().insert(left);
}

fn is_reachable(graph: &HashMap<Uuid, HashSet<Uuid>>, start: Uuid, target: Uuid) -> bool {
    if start == target {
        return true;
    }
    let mut queue = VecDeque::from([start]);
    let mut visited = HashSet::from([start]);
    while let Some(node) = queue.pop_front() {
        if let Some(neighbors) = graph.get(&node) {
            for neighbor in neighbors {
                if *neighbor == target {
                    return true;
                }
                if visited.insert(*neighbor) {
                    queue.push_back(*neighbor);
                }
            }
        }
    }
    false
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
