use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::features::file_inventory::{FileCategory, FileStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SearchOrigin {
    Managed,
    Discovered,
}

impl SearchOrigin {
    pub(super) fn is_managed(self) -> bool {
        matches!(self, Self::Managed)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SearchSortField {
    Relevance,
    Name,
    Project,
    Modified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SearchSortDirection {
    Ascending,
    Descending,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchMetadataRequest {
    pub(crate) query: String,
    pub(crate) project_id: Option<String>,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) sort_by: SearchSortField,
    pub(crate) sort_direction: SearchSortDirection,
    pub(crate) categories: Vec<FileCategory>,
    pub(crate) extensions: Vec<String>,
    pub(crate) tags: Vec<String>,
    pub(crate) environment_ids: Vec<String>,
    pub(crate) statuses: Vec<FileStatus>,
    pub(crate) origins: Vec<SearchOrigin>,
    pub(crate) modified_from_ms: Option<i64>,
    pub(crate) modified_to_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct SearchQuery {
    pub(super) request: SearchMetadataRequest,
    pub(super) project_id: Option<Uuid>,
    pub(super) environment_ids: Vec<Uuid>,
}

impl SearchQuery {
    pub(super) fn has_file_filters(&self) -> bool {
        !self.request.categories.is_empty()
            || !self.request.extensions.is_empty()
            || !self.request.tags.is_empty()
            || !self.request.statuses.is_empty()
            || !self.request.origins.is_empty()
            || self.request.modified_from_ms.is_some()
            || self.request.modified_to_ms.is_some()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "resultType", rename_all = "snake_case")]
pub(crate) enum SearchResult {
    Project {
        id: Uuid,
        #[serde(rename = "projectId")]
        project_id: Uuid,
        #[serde(rename = "projectName")]
        project_name: String,
        name: String,
    },
    File {
        id: Uuid,
        #[serde(rename = "projectId")]
        project_id: Uuid,
        #[serde(rename = "projectName")]
        project_name: String,
        name: String,
        #[serde(rename = "relativePath")]
        relative_path: String,
        extension: Option<String>,
        category: FileCategory,
        status: FileStatus,
        origin: SearchOrigin,
        #[serde(rename = "modifiedAtMs")]
        modified_at_ms: Option<i64>,
        tags: Vec<String>,
        note: Option<String>,
    },
    EnvironmentKey {
        id: Uuid,
        #[serde(rename = "projectId")]
        project_id: Uuid,
        #[serde(rename = "projectName")]
        project_name: String,
        name: String,
        #[serde(rename = "environmentId")]
        environment_id: Uuid,
        #[serde(rename = "environmentName")]
        environment_name: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchMetadataPage {
    pub(crate) items: Vec<SearchResult>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
    pub(crate) has_more: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchHistoryEntry {
    pub(crate) id: Uuid,
    pub(crate) request: SearchMetadataRequest,
    pub(crate) created_at: String,
}

#[derive(Debug, sqlx::FromRow)]
pub(super) struct SearchResultRow {
    pub(super) result_type: String,
    pub(super) id: String,
    pub(super) project_id: String,
    pub(super) project_name: String,
    pub(super) name: String,
    pub(super) relative_path: Option<String>,
    pub(super) extension: Option<String>,
    pub(super) category: Option<String>,
    pub(super) status: Option<String>,
    pub(super) origin: Option<String>,
    pub(super) modified_at_ms: Option<i64>,
    pub(super) tags: Option<String>,
    pub(super) note: Option<String>,
    pub(super) environment_id: Option<String>,
    pub(super) environment_name: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub(super) struct SearchHistoryRow {
    pub(super) id: String,
    pub(super) request_json: String,
    pub(super) created_at: String,
}
