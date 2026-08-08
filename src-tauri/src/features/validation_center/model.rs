use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ValidationRuleType {
    Required,
    Optional,
    Forbidden,
}

impl ValidationRuleType {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Required => "required",
            Self::Optional => "optional",
            Self::Forbidden => "forbidden",
        }
    }
}

impl TryFrom<&str> for ValidationRuleType {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "required" => Ok(Self::Required),
            "optional" => Ok(Self::Optional),
            "forbidden" => Ok(Self::Forbidden),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ValidationSeverity {
    Info,
    Warning,
    Error,
}

impl ValidationSeverity {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }
}

impl TryFrom<&str> for ValidationSeverity {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, ()> {
        match value {
            "info" => Ok(Self::Info),
            "warning" => Ok(Self::Warning),
            "error" => Ok(Self::Error),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ValidationIssueType {
    RequiredMissing,
    RequiredCommented,
    ForbiddenPresent,
    UnexpectedPresent,
    Duplicate,
    CaseMismatch,
    InvalidName,
    SourceUnreadable,
    ParseIssue,
}

impl ValidationIssueType {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::RequiredMissing => "required_missing",
            Self::RequiredCommented => "required_commented",
            Self::ForbiddenPresent => "forbidden_present",
            Self::UnexpectedPresent => "unexpected_present",
            Self::Duplicate => "duplicate",
            Self::CaseMismatch => "case_mismatch",
            Self::InvalidName => "invalid_name",
            Self::SourceUnreadable => "source_unreadable",
            Self::ParseIssue => "parse_issue",
        }
    }
}

impl TryFrom<&str> for ValidationIssueType {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "required_missing" => Ok(Self::RequiredMissing),
            "required_commented" => Ok(Self::RequiredCommented),
            "forbidden_present" => Ok(Self::ForbiddenPresent),
            "unexpected_present" => Ok(Self::UnexpectedPresent),
            "duplicate" => Ok(Self::Duplicate),
            "case_mismatch" => Ok(Self::CaseMismatch),
            "invalid_name" => Ok(Self::InvalidName),
            "source_unreadable" => Ok(Self::SourceUnreadable),
            "parse_issue" => Ok(Self::ParseIssue),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ValidationIssueStatus {
    Open,
    Ignored,
    Resolved,
}

impl ValidationIssueStatus {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Ignored => "ignored",
            Self::Resolved => "resolved",
        }
    }
}

impl TryFrom<&str> for ValidationIssueStatus {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "open" => Ok(Self::Open),
            "ignored" => Ok(Self::Ignored),
            "resolved" => Ok(Self::Resolved),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EnvironmentHealth {
    Healthy,
    Warning,
    Error,
    Unknown,
}

impl EnvironmentHealth {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Healthy => "healthy",
            Self::Warning => "warning",
            Self::Error => "error",
            Self::Unknown => "unknown",
        }
    }
}

impl TryFrom<&str> for EnvironmentHealth {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, ()> {
        match value {
            "healthy" => Ok(Self::Healthy),
            "warning" => Ok(Self::Warning),
            "error" => Ok(Self::Error),
            "unknown" => Ok(Self::Unknown),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ValidationRule {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) key_name: String,
    pub(crate) rule_type: ValidationRuleType,
    pub(crate) severity: ValidationSeverity,
    pub(crate) description: Option<String>,
    pub(crate) sort_order: u32,
    pub(crate) enabled: bool,
    pub(crate) environment_ids: Vec<Uuid>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone)]
pub(crate) struct SaveValidationRule {
    pub(crate) project_id: Uuid,
    pub(crate) rule_id: Option<Uuid>,
    pub(crate) key_name: String,
    pub(crate) rule_type: ValidationRuleType,
    pub(crate) severity: ValidationSeverity,
    pub(crate) description: Option<String>,
    pub(crate) enabled: bool,
    pub(crate) environment_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ValidationIssueSort {
    UpdatedAt,
    Severity,
    Key,
    Environment,
    Status,
}

#[derive(Debug, Clone)]
pub(crate) struct ValidationIssueQuery {
    pub(crate) project_id: Uuid,
    pub(crate) search: Option<String>,
    pub(crate) environment_id: Option<Uuid>,
    pub(crate) issue_type: Option<ValidationIssueType>,
    pub(crate) rule_type: Option<ValidationRuleType>,
    pub(crate) severity: Option<ValidationSeverity>,
    pub(crate) status: Option<ValidationIssueStatus>,
    pub(crate) sort: ValidationIssueSort,
    pub(crate) descending: bool,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ValidationIssue {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) environment_id: Option<Uuid>,
    pub(crate) environment_name: Option<String>,
    pub(crate) rule_id: Option<Uuid>,
    pub(crate) key_name: String,
    pub(crate) issue_type: ValidationIssueType,
    pub(crate) severity: ValidationSeverity,
    pub(crate) status: ValidationIssueStatus,
    pub(crate) message: String,
    pub(crate) source_path: Option<String>,
    pub(crate) line_number: Option<u32>,
    pub(crate) observed_name: Option<String>,
    pub(crate) first_seen_at: String,
    pub(crate) last_seen_at: String,
    pub(crate) resolved_at: Option<String>,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ValidationIssuePage {
    pub(crate) items: Vec<ValidationIssue>,
    pub(crate) total_items: u64,
    pub(crate) page: u32,
    pub(crate) page_size: u32,
    pub(crate) total_pages: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ValidationSummary {
    pub(crate) health: EnvironmentHealth,
    pub(crate) open_issues: u64,
    pub(crate) error_issues: u64,
    pub(crate) warning_issues: u64,
    pub(crate) info_issues: u64,
    pub(crate) ignored_issues: u64,
    pub(crate) resolved_issues: u64,
    pub(crate) last_successful_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ValidationRunResult {
    pub(crate) summary: ValidationSummary,
    pub(crate) issues_detected: u64,
    pub(crate) issues_resolved: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ManifestCollisionChoice {
    Cancel,
    Replace,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ManifestExport {
    pub(crate) relative_path: String,
    pub(crate) key_count: u64,
    pub(crate) replaced: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ValidationEnvironment {
    pub(super) id: Uuid,
    pub(super) name: String,
    pub(super) sort_order: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ValidationSourceStatus {
    Parsed,
    Missing,
    Unreadable,
    ParseIssue,
    UnsupportedEncoding,
    NotParsed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ValidationSource {
    pub(super) id: Uuid,
    pub(super) environment_id: Uuid,
    pub(super) relative_path: String,
    pub(super) status: ValidationSourceStatus,
    pub(super) issue_code: Option<String>,
    pub(super) issue_line: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ValidationOccurrence {
    pub(super) key_definition_id: Uuid,
    pub(super) environment_id: Uuid,
    pub(super) source_id: Uuid,
    pub(super) key_name: String,
    pub(super) observed_name: String,
    pub(super) normalized_key: String,
    pub(super) line_number: u32,
    pub(super) is_commented: bool,
    pub(super) is_duplicate: bool,
}

#[derive(Debug, Clone)]
pub(super) struct ValidationSnapshot {
    pub(super) project_id: Uuid,
    pub(super) environments: Vec<ValidationEnvironment>,
    pub(super) sources: Vec<ValidationSource>,
    pub(super) occurrences: Vec<ValidationOccurrence>,
    pub(super) rules: Vec<ValidationRule>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct DetectedIssue {
    pub(super) fingerprint: String,
    pub(super) environment_id: Option<Uuid>,
    pub(super) key_definition_id: Option<Uuid>,
    pub(super) rule_id: Option<Uuid>,
    pub(super) source_id: Option<Uuid>,
    pub(super) key_name: String,
    pub(super) normalized_key: String,
    pub(super) issue_type: ValidationIssueType,
    pub(super) severity: ValidationSeverity,
    pub(super) message: String,
    pub(super) source_path: Option<String>,
    pub(super) line_number: Option<u32>,
    pub(super) observed_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ValidationEvaluation {
    pub(super) issues: Vec<DetectedIssue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ManifestPreview {
    pub(crate) relative_path: String,
    pub(crate) content: String,
    pub(crate) key_count: u64,
    pub(crate) exists: bool,
}
