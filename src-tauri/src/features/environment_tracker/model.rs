use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Environment {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) name: String,
    pub(crate) description: Option<String>,
    pub(crate) sort_order: u32,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EnvironmentSourceParseStatus {
    NotParsed,
    Parsed,
    Missing,
    Unreadable,
    ParseIssue,
    UnsupportedEncoding,
}

impl EnvironmentSourceParseStatus {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::NotParsed => "not_parsed",
            Self::Parsed => "parsed",
            Self::Missing => "missing",
            Self::Unreadable => "unreadable",
            Self::ParseIssue => "parse_issue",
            Self::UnsupportedEncoding => "unsupported_encoding",
        }
    }
}

impl TryFrom<&str> for EnvironmentSourceParseStatus {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "not_parsed" => Ok(Self::NotParsed),
            "parsed" => Ok(Self::Parsed),
            "missing" => Ok(Self::Missing),
            "unreadable" => Ok(Self::Unreadable),
            "parse_issue" => Ok(Self::ParseIssue),
            "unsupported_encoding" => Ok(Self::UnsupportedEncoding),
            _ => Err(()),
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
    pub(crate) sort_order: u32,
    pub(crate) parse_status: EnvironmentSourceParseStatus,
    pub(crate) last_observed_size_bytes: Option<u64>,
    pub(crate) last_observed_modified_at_ms: Option<i64>,
    pub(crate) last_parsed_at: Option<String>,
    pub(crate) last_successful_parse_at: Option<String>,
    pub(crate) last_issue_line: Option<u32>,
    pub(crate) last_issue_code: Option<String>,
    pub(crate) last_issue_message: Option<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentSourceCandidate {
    pub(crate) relative_path: String,
    pub(crate) name: String,
    pub(crate) extension: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentSourceCandidatePage {
    pub(crate) items: Vec<EnvironmentSourceCandidate>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EnvironmentMatrixCellState {
    Present,
    Duplicate,
    Commented,
    Absent,
    SourceUnreadable,
    ParseIssue,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentMatrixSourceDetail {
    pub(crate) relative_path: String,
    pub(crate) line_number: Option<u32>,
    pub(crate) is_commented: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentMatrixCell {
    pub(crate) state: EnvironmentMatrixCellState,
    pub(crate) source_details: Vec<EnvironmentMatrixSourceDetail>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentMatrixRow {
    pub(crate) key_name: String,
    pub(crate) cells: Vec<EnvironmentMatrixCell>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentMatrixPage {
    pub(crate) environments: Vec<Environment>,
    pub(crate) rows: Vec<EnvironmentMatrixRow>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
}

#[derive(Debug, Clone)]
pub(crate) struct CreateEnvironment {
    pub(super) project_id: Uuid,
    pub(super) name: String,
    pub(super) description: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct UpdateEnvironment {
    pub(super) project_id: Uuid,
    pub(super) environment_id: Uuid,
    pub(super) name: String,
    pub(super) description: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct EnvironmentSourceCandidateQuery {
    pub(super) project_id: Uuid,
    pub(super) search: Option<String>,
    pub(super) page: u32,
    pub(super) page_size: u32,
}

#[derive(Debug, Clone)]
pub(crate) struct EnvironmentMatrixQuery {
    pub(super) project_id: Uuid,
    pub(super) search: Option<String>,
    pub(super) page: u32,
    pub(super) page_size: u32,
}
