use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SourceStatus {
    Ready,
    Missing,
    Unreadable,
    ParseError,
}

impl SourceStatus {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Ready => "ready",
            Self::Missing => "missing",
            Self::Unreadable => "unreadable",
            Self::ParseError => "parse_error",
        }
    }
}

impl TryFrom<&str> for SourceStatus {
    type Error = super::error::EnvironmentError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "ready" => Ok(Self::Ready),
            "missing" => Ok(Self::Missing),
            "unreadable" => Ok(Self::Unreadable),
            "parse_error" => Ok(Self::ParseError),
            _ => Err(super::error::EnvironmentError::InvalidPersistedData),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ParseStatus {
    Pending,
    Parsed,
    Failed,
}

impl TryFrom<&str> for ParseStatus {
    type Error = super::error::EnvironmentError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "pending" => Ok(Self::Pending),
            "parsed" => Ok(Self::Parsed),
            "failed" => Ok(Self::Failed),
            _ => Err(super::error::EnvironmentError::InvalidPersistedData),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentSource {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) environment_id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) priority: u32,
    pub(crate) status: SourceStatus,
    pub(crate) parse_status: ParseStatus,
    pub(crate) size_bytes: Option<u64>,
    pub(crate) modified_at_ms: Option<i64>,
    pub(crate) issue_count: u32,
    pub(crate) last_parsed_at: Option<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Environment {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) name: String,
    pub(crate) description: Option<String>,
    pub(crate) sort_order: u32,
    pub(crate) sources: Vec<EnvironmentSource>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct EnvironmentDraft {
    pub(super) project_id: Uuid,
    pub(super) name: String,
    pub(super) normalized_name: String,
    pub(super) description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct EnvironmentUpdate {
    pub(super) project_id: Uuid,
    pub(super) environment_id: Uuid,
    pub(super) name: String,
    pub(super) normalized_name: String,
    pub(super) description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct SourceDraft {
    pub(super) id: Uuid,
    pub(super) project_id: Uuid,
    pub(super) environment_id: Uuid,
    pub(super) relative_path: String,
    pub(super) canonical_path_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ParsedOccurrence {
    pub(super) key_name: String,
    pub(super) normalized_name: String,
    pub(super) line_number: u32,
    pub(super) commented: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ParseIssue {
    pub(crate) line_number: u32,
    pub(crate) issue_code: &'static str,
    pub(crate) message: &'static str,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct ParsedEnvironmentFile {
    pub(super) occurrences: Vec<ParsedOccurrence>,
    pub(super) issues: Vec<ParseIssue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RefreshSummary {
    pub(crate) sources_requested: u32,
    pub(crate) sources_parsed: u32,
    pub(crate) sources_unavailable: u32,
    pub(crate) keys_found: u32,
    pub(crate) issues_found: u32,
}

impl RefreshSummary {
    pub(super) fn include(&mut self, other: Self) {
        self.sources_requested += other.sources_requested;
        self.sources_parsed += other.sources_parsed;
        self.sources_unavailable += other.sources_unavailable;
        self.keys_found += other.keys_found;
        self.issues_found += other.issues_found;
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SourceCandidate {
    pub(crate) id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) name: String,
    pub(crate) status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SourceCandidatePage {
    pub(crate) items: Vec<SourceCandidate>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct SourceCandidateQuery {
    pub(super) project_id: Uuid,
    pub(super) search: Option<String>,
    pub(super) page: u32,
    pub(super) page_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct MatrixQuery {
    pub(super) project_id: Uuid,
    pub(super) search: Option<String>,
    pub(super) page: u32,
    pub(super) page_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MatrixCellState {
    Present,
    Duplicate,
    Commented,
    Absent,
    SourceUnreadable,
    ParseIssue,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MatrixOccurrence {
    pub(crate) source_id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) line_number: u32,
    pub(crate) source_priority: u32,
    pub(crate) commented: bool,
    pub(crate) duplicate: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MatrixCell {
    pub(crate) environment_id: Uuid,
    pub(crate) state: MatrixCellState,
    pub(crate) duplicate_count: u32,
    pub(crate) occurrences: Vec<MatrixOccurrence>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MatrixRow {
    pub(crate) key_definition_id: Uuid,
    pub(crate) key_name: String,
    pub(crate) cells: Vec<MatrixCell>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MatrixColumn {
    pub(crate) environment_id: Uuid,
    pub(crate) name: String,
    pub(crate) sort_order: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MatrixPage {
    pub(crate) columns: Vec<MatrixColumn>,
    pub(crate) rows: Vec<MatrixRow>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
}
