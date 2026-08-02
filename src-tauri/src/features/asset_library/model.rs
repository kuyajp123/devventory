use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::features::file_inventory::FileCategory;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum AssetOrigin {
    Managed,
    Discovered,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CollisionChoice {
    Cancel,
    Replace,
    KeepBoth,
    Rename,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AssetSortField {
    RelativePath,
    Name,
    Category,
    SizeBytes,
    ModifiedAtMs,
    UpdatedAt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SortDirection {
    Ascending,
    Descending,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AssetQuery {
    pub(crate) project_id: Uuid,
    pub(crate) search: Option<String>,
    pub(crate) category: Option<FileCategory>,
    pub(crate) extension: Option<String>,
    pub(crate) tag: Option<String>,
    pub(crate) favorite: Option<bool>,
    pub(crate) origin: Option<AssetOrigin>,
    pub(crate) sort_by: AssetSortField,
    pub(crate) sort_direction: SortDirection,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Asset {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) name: String,
    pub(crate) extension: Option<String>,
    pub(crate) mime_type: Option<String>,
    pub(crate) size_bytes: u64,
    pub(crate) modified_at_ms: Option<i64>,
    pub(crate) category: FileCategory,
    pub(crate) origin: AssetOrigin,
    pub(crate) status: String,
    pub(crate) favorite: bool,
    pub(crate) tags: Vec<String>,
    pub(crate) note: Option<String>,
    pub(crate) variant_ids: Vec<Uuid>,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AssetPage {
    pub(crate) items: Vec<Asset>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DuplicateMatch {
    pub(crate) asset_id: Uuid,
    pub(crate) relative_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AssetPreview {
    pub(crate) name: String,
    pub(crate) extension: Option<String>,
    pub(crate) mime_type: Option<String>,
    pub(crate) size_bytes: u64,
    pub(crate) category: FileCategory,
    pub(crate) duplicate: Option<DuplicateMatch>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SourceFile {
    pub(crate) canonical_path: PathBuf,
    pub(crate) name: String,
    pub(crate) size_bytes: u64,
    pub(crate) modified_at_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedDestination {
    pub(crate) directory: PathBuf,
    pub(crate) relative_directory: String,
    pub(crate) filename: String,
    pub(crate) watched_location_id: Uuid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ImportAsset {
    pub(crate) project_id: Uuid,
    pub(crate) source_path: String,
    pub(crate) destination: String,
    pub(crate) filename: Option<String>,
    pub(crate) collision: CollisionChoice,
    pub(crate) tags: Vec<String>,
    pub(crate) note: Option<String>,
    pub(crate) favorite: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AssetMetadataUpdate {
    pub(crate) project_id: Uuid,
    pub(crate) asset_id: Uuid,
    pub(crate) tags: Vec<String>,
    pub(crate) note: Option<String>,
    pub(crate) favorite: bool,
    pub(crate) variant_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ImportStatus {
    Imported,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportResult {
    pub(crate) status: ImportStatus,
    pub(crate) asset: Option<Asset>,
    pub(crate) duplicate: Option<DuplicateMatch>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HashCandidate {
    pub(crate) asset_id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) content_hash: Option<String>,
    pub(crate) hashed_size_bytes: Option<u64>,
    pub(crate) hashed_modified_at_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ImportedFileRecord {
    pub(crate) project_id: Uuid,
    pub(crate) watched_location_id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) name: String,
    pub(crate) extension: Option<String>,
    pub(crate) mime_type: Option<String>,
    pub(crate) size_bytes: u64,
    pub(crate) modified_at_ms: Option<i64>,
    pub(crate) category: FileCategory,
    pub(crate) content_hash: String,
    pub(crate) tags: Vec<String>,
    pub(crate) note: Option<String>,
    pub(crate) favorite: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum QuickAction {
    Open,
    Reveal,
    OpenInVscode,
    CopyRelativePath,
    CopyAbsolutePath,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ActionTarget {
    pub(crate) absolute_path: PathBuf,
    pub(crate) relative_path: String,
}
