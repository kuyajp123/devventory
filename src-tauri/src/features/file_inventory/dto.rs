use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::error::FileInventoryError;
use super::model::{
    FileCategory, FileSourceType, FileStatus, IndexedFile, InventoryPage, InventoryQuery,
    InventoryWatchedLocation, ScanRun, ScanStatus, ScanType,
};

const MAX_SEARCH_LENGTH: usize = 128;
const MAX_EXTENSION_LENGTH: usize = 32;
const MAX_PAGE_SIZE: u32 = 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FileInventoryQueryInput {
    project_id: String,
    search: Option<String>,
    category: Option<FileCategory>,
    extension: Option<String>,
    status: Option<FileStatus>,
    page: u32,
    page_size: u32,
}

impl TryFrom<FileInventoryQueryInput> for InventoryQuery {
    type Error = FileInventoryError;

    fn try_from(input: FileInventoryQueryInput) -> Result<Self, Self::Error> {
        let project_id =
            Uuid::parse_str(&input.project_id).map_err(|_| FileInventoryError::InvalidFilter)?;
        let search = input
            .search
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());
        if search
            .as_ref()
            .is_some_and(|value| value.chars().count() > MAX_SEARCH_LENGTH)
            || input.page == 0
            || input.page_size == 0
            || input.page_size > MAX_PAGE_SIZE
        {
            return Err(FileInventoryError::InvalidFilter);
        }

        let extension = input
            .extension
            .map(|value| value.trim().trim_start_matches('.').to_lowercase())
            .filter(|value| !value.is_empty());
        if extension.as_ref().is_some_and(|value| {
            value.chars().count() > MAX_EXTENSION_LENGTH
                || !value.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '-' | '_')
                })
        }) {
            return Err(FileInventoryError::InvalidFilter);
        }

        Ok(Self {
            project_id,
            search,
            category: input.category,
            extension,
            status: input.status,
            page: input.page,
            page_size: input.page_size,
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InventoryPageDto {
    items: Vec<IndexedFileDto>,
    total_items: u64,
    page: u32,
    page_size: u32,
    total_pages: u32,
    recent_scans: Vec<ScanRunDto>,
    watched_locations: Vec<InventoryWatchedLocationDto>,
}

impl From<InventoryPage> for InventoryPageDto {
    fn from(page: InventoryPage) -> Self {
        Self {
            items: page.items.into_iter().map(Into::into).collect(),
            total_items: page.total_items,
            page: page.page,
            page_size: page.page_size,
            total_pages: page.total_pages,
            recent_scans: page.recent_scans.into_iter().map(Into::into).collect(),
            watched_locations: page.watched_locations.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InventoryWatchedLocationDto {
    id: String,
    relative_path: String,
}

impl From<InventoryWatchedLocation> for InventoryWatchedLocationDto {
    fn from(location: InventoryWatchedLocation) -> Self {
        Self {
            id: location.id.to_string(),
            relative_path: location.relative_path,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexedFileDto {
    id: String,
    project_id: String,
    watched_location_id: Option<String>,
    relative_path: String,
    name: String,
    extension: Option<String>,
    mime_type: Option<String>,
    size_bytes: u64,
    modified_at_ms: Option<i64>,
    category: FileCategory,
    source_type: FileSourceType,
    status: FileStatus,
    first_seen_at: String,
    last_seen_at: String,
    updated_at: String,
}

impl From<IndexedFile> for IndexedFileDto {
    fn from(file: IndexedFile) -> Self {
        Self {
            id: file.id.to_string(),
            project_id: file.project_id.to_string(),
            watched_location_id: file.watched_location_id.map(|id| id.to_string()),
            relative_path: file.relative_path,
            name: file.name,
            extension: file.extension,
            mime_type: file.mime_type,
            size_bytes: file.size_bytes,
            modified_at_ms: file.modified_at_ms,
            category: file.category,
            source_type: file.source_type,
            status: file.status,
            first_seen_at: file.first_seen_at,
            last_seen_at: file.last_seen_at,
            updated_at: file.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanRunDto {
    id: String,
    project_id: String,
    watched_location_id: Option<String>,
    scan_type: ScanType,
    status: ScanStatus,
    files_discovered: u64,
    files_added: u64,
    files_updated: u64,
    files_unchanged: u64,
    files_missing: u64,
    directories_visited: u64,
    entries_excluded: u64,
    entries_unreadable: u64,
    duration_ms: u64,
    error_summary: Option<String>,
    started_at: String,
    completed_at: Option<String>,
}

impl From<ScanRun> for ScanRunDto {
    fn from(scan: ScanRun) -> Self {
        Self {
            id: scan.id.to_string(),
            project_id: scan.project_id.to_string(),
            watched_location_id: scan.watched_location_id.map(|id| id.to_string()),
            scan_type: scan.scan_type,
            status: scan.status,
            files_discovered: scan.files_discovered,
            files_added: scan.files_added,
            files_updated: scan.files_updated,
            files_unchanged: scan.files_unchanged,
            files_missing: scan.files_missing,
            directories_visited: scan.directories_visited,
            entries_excluded: scan.entries_excluded,
            entries_unreadable: scan.entries_unreadable,
            duration_ms: scan.duration_ms,
            error_summary: scan.error_summary,
            started_at: scan.started_at,
            completed_at: scan.completed_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::FileInventoryQueryInput;
    use crate::features::file_inventory::model::InventoryQuery;

    #[test]
    fn normalizes_safe_inventory_filters_and_rejects_unbounded_inputs() {
        let project_id = uuid::Uuid::new_v4();
        let query = InventoryQuery::try_from(FileInventoryQueryInput {
            project_id: project_id.to_string(),
            search: Some("  main  ".to_owned()),
            category: None,
            extension: Some(".TSX".to_owned()),
            status: None,
            page: 1,
            page_size: 50,
        })
        .expect("valid query");
        assert_eq!(query.project_id, project_id);
        assert_eq!(query.search.as_deref(), Some("main"));
        assert_eq!(query.extension.as_deref(), Some("tsx"));

        assert!(InventoryQuery::try_from(FileInventoryQueryInput {
            project_id: project_id.to_string(),
            search: Some("x".repeat(129)),
            category: None,
            extension: None,
            status: None,
            page: 1,
            page_size: 50,
        })
        .is_err());
    }
}
