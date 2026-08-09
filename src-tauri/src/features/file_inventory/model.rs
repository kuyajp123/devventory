use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::error::FileInventoryError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum FileCategory {
    Source,
    Document,
    Image,
    Audio,
    Video,
    Archive,
    Font,
    Configuration,
    Other,
}

impl FileCategory {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Source => "source",
            Self::Document => "document",
            Self::Image => "image",
            Self::Audio => "audio",
            Self::Video => "video",
            Self::Archive => "archive",
            Self::Font => "font",
            Self::Configuration => "configuration",
            Self::Other => "other",
        }
    }
}

impl TryFrom<&str> for FileCategory {
    type Error = FileInventoryError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "source" => Ok(Self::Source),
            "document" => Ok(Self::Document),
            "image" => Ok(Self::Image),
            "audio" => Ok(Self::Audio),
            "video" => Ok(Self::Video),
            "archive" => Ok(Self::Archive),
            "font" => Ok(Self::Font),
            "configuration" => Ok(Self::Configuration),
            "other" => Ok(Self::Other),
            _ => Err(FileInventoryError::InvalidPersistedData),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum FileStatus {
    Active,
    Missing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum FileSourceType {
    Discovered,
}

impl TryFrom<&str> for FileSourceType {
    type Error = FileInventoryError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "discovered" => Ok(Self::Discovered),
            _ => Err(FileInventoryError::InvalidPersistedData),
        }
    }
}

impl FileStatus {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Missing => "missing",
        }
    }
}

impl TryFrom<&str> for FileStatus {
    type Error = FileInventoryError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "active" => Ok(Self::Active),
            "missing" => Ok(Self::Missing),
            _ => Err(FileInventoryError::InvalidPersistedData),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ScanType {
    Initial,
    Startup,
    ManualProject,
    ManualLocation,
    Watcher,
}

impl ScanType {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Initial => "initial",
            Self::Startup => "startup",
            Self::ManualProject => "manual_project",
            Self::ManualLocation => "manual_location",
            Self::Watcher => "watcher",
        }
    }
}

impl TryFrom<&str> for ScanType {
    type Error = FileInventoryError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "initial" => Ok(Self::Initial),
            "startup" => Ok(Self::Startup),
            "manual_project" => Ok(Self::ManualProject),
            "manual_location" => Ok(Self::ManualLocation),
            "watcher" => Ok(Self::Watcher),
            _ => Err(FileInventoryError::InvalidPersistedData),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ScanStatus {
    Running,
    Completed,
    Partial,
    Failed,
}

impl ScanStatus {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Partial => "partial",
            Self::Failed => "failed",
        }
    }
}

impl TryFrom<&str> for ScanStatus {
    type Error = FileInventoryError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "running" => Ok(Self::Running),
            "completed" => Ok(Self::Completed),
            "partial" => Ok(Self::Partial),
            "failed" => Ok(Self::Failed),
            _ => Err(FileInventoryError::InvalidPersistedData),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ScannedFile {
    pub(super) watched_location_id: Uuid,
    pub(super) relative_path: String,
    pub(super) name: String,
    pub(super) extension: Option<String>,
    pub(super) mime_type: Option<String>,
    pub(super) size_bytes: u64,
    pub(super) modified_at_ms: Option<i64>,
    pub(super) category: FileCategory,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct ScanTraversalSummary {
    pub(super) files_discovered: u64,
    pub(super) directories_visited: u64,
    pub(super) entries_excluded: u64,
    pub(super) entries_unreadable: u64,
    pub(super) duration_ms: u64,
    pub(super) completed: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct PersistenceSummary {
    pub(super) files_added: u64,
    pub(super) files_updated: u64,
    pub(super) files_unchanged: u64,
    pub(super) files_missing: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanRun {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) watched_location_id: Option<Uuid>,
    pub(crate) scan_type: ScanType,
    pub(crate) status: ScanStatus,
    pub(crate) files_discovered: u64,
    pub(crate) files_added: u64,
    pub(crate) files_updated: u64,
    pub(crate) files_unchanged: u64,
    pub(crate) files_missing: u64,
    pub(crate) directories_visited: u64,
    pub(crate) entries_excluded: u64,
    pub(crate) entries_unreadable: u64,
    pub(crate) duration_ms: u64,
    pub(crate) error_summary: Option<String>,
    pub(crate) started_at: String,
    pub(crate) completed_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IndexedFile {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) watched_location_id: Option<Uuid>,
    pub(crate) relative_path: String,
    pub(crate) name: String,
    pub(crate) extension: Option<String>,
    pub(crate) mime_type: Option<String>,
    pub(crate) size_bytes: u64,
    pub(crate) modified_at_ms: Option<i64>,
    pub(crate) category: FileCategory,
    pub(crate) source_type: FileSourceType,
    pub(crate) status: FileStatus,
    pub(crate) first_seen_at: String,
    pub(crate) last_seen_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum InventorySortField {
    RelativePath,
    Name,
    Category,
    SizeBytes,
    ModifiedAtMs,
    Status,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SortDirection {
    Ascending,
    Descending,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct InventoryQuery {
    pub(crate) project_id: Uuid,
    pub(crate) search: Option<String>,
    pub(crate) category: Option<FileCategory>,
    pub(crate) extension: Option<String>,
    pub(crate) status: Option<FileStatus>,
    pub(crate) sort_by: InventorySortField,
    pub(crate) sort_direction: SortDirection,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) parent_folder: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProjectDirectoryEntry {
    pub(crate) name: String,
    pub(crate) relative_path: String,
    pub(crate) is_watched: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProjectDirectoryPage {
    pub(crate) items: Vec<ProjectDirectoryEntry>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
    pub(crate) has_more: bool,
    pub(crate) entries_unreadable: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProjectDirectoryQuery {
    pub(crate) project_id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InventoryPage {
    pub(crate) items: Vec<IndexedFile>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
    pub(crate) recent_scans: Vec<ScanRun>,
    pub(crate) watched_locations: Vec<InventoryWatchedLocation>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InventoryWatchedLocation {
    pub(crate) id: Uuid,
    pub(crate) relative_path: String,
}
