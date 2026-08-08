use serde::Serialize;
use uuid::Uuid;

use crate::features::file_inventory::{FileCategory, ScanStatus, ScanType};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectDashboard {
    pub(crate) project_id: Uuid,
    pub(crate) metrics: DashboardMetrics,
    pub(crate) file_categories: Vec<CategoryMetric>,
    pub(crate) validation_severities: Vec<SeverityMetric>,
    pub(crate) environment_coverage: Vec<EnvironmentCoverage>,
    pub(crate) recent_scans: Vec<DashboardScan>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DashboardMetrics {
    pub(crate) indexed_files: u64,
    pub(crate) missing_files: u64,
    pub(crate) managed_assets: u64,
    pub(crate) environments: u64,
    pub(crate) environment_keys: u64,
    pub(crate) open_validation_issues: u64,
    pub(crate) watched_locations: u64,
    pub(crate) watcher_status: DashboardWatcherStatus,
    pub(crate) last_scan_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DashboardWatcherStatus {
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CategoryMetric {
    pub(crate) category: FileCategory,
    pub(crate) count: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DashboardValidationSeverity {
    Info,
    Warning,
    Error,
}

impl TryFrom<&str> for DashboardValidationSeverity {
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SeverityMetric {
    pub(crate) severity: DashboardValidationSeverity,
    pub(crate) count: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentCoverage {
    pub(crate) environment_id: Uuid,
    pub(crate) name: String,
    pub(crate) known_keys: u64,
    pub(crate) present_keys: u64,
    pub(crate) coverage_percent: Option<f64>,
    pub(crate) unavailable_sources: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DashboardScan {
    pub(crate) id: Uuid,
    pub(crate) scan_type: ScanType,
    pub(crate) status: ScanStatus,
    pub(crate) files_discovered: u64,
    pub(crate) files_added: u64,
    pub(crate) files_updated: u64,
    pub(crate) files_missing: u64,
    pub(crate) entries_unreadable: u64,
    pub(crate) duration_ms: u64,
    pub(crate) started_at: String,
    pub(crate) completed_at: Option<String>,
}
