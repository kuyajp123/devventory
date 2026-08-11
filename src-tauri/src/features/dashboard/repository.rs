use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

use crate::features::file_inventory::{FileCategory, ScanStatus, ScanType};

use super::error::DashboardError;
use super::model::{
    CategoryMetric, DashboardMetrics, DashboardScan, DashboardValidationSeverity,
    DashboardWatcherStatus, EnvironmentCoverage, ProjectDashboard, SeverityMetric,
};

const RECENT_SCAN_LIMIT: i64 = 8;

#[derive(Debug, Clone)]
pub(crate) struct SqliteDashboardRepository {
    pool: SqlitePool,
}

impl SqliteDashboardRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub(crate) async fn get(&self, project_id: Uuid) -> Result<ProjectDashboard, DashboardError> {
        let project_id_text = project_id.to_string();
        let mut transaction = self.pool.begin().await?;

        let metrics = sqlx::query_as::<_, MetricsRow>(
            "SELECT
                (SELECT COUNT(*) FROM indexed_files f WHERE f.project_id = p.id) AS indexed_files,
                (SELECT COUNT(*) FROM indexed_files f WHERE f.project_id = p.id AND f.status = 'missing') AS missing_files,
                (SELECT COUNT(*) FROM indexed_files f WHERE f.project_id = p.id AND f.managed = 1 AND f.status = 'active') AS managed_assets,
                (SELECT COUNT(*) FROM environments e WHERE e.project_id = p.id) AS environments,
                (SELECT COUNT(*) FROM environment_key_definitions k WHERE k.project_id = p.id) AS environment_keys,
                (SELECT COUNT(*) FROM validation_issues i WHERE i.project_id = p.id AND i.status = 'open') AS open_validation_issues,
                (SELECT COUNT(*) FROM watched_locations w WHERE w.project_id = p.id) AS watched_locations,
                (SELECT MAX(s.started_at) FROM scan_runs s WHERE s.project_id = p.id) AS last_scan_at
             FROM projects p WHERE p.id = ?",
        )
        .bind(&project_id_text)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or(DashboardError::ProjectNotFound)?
        .try_into()?;

        let file_categories = sqlx::query_as::<_, CategoryRow>(
            "SELECT category, COUNT(*) AS count
             FROM indexed_files WHERE project_id = ?
             GROUP BY category ORDER BY count DESC, category ASC",
        )
        .bind(&project_id_text)
        .fetch_all(&mut *transaction)
        .await?
        .into_iter()
        .map(CategoryMetric::try_from)
        .collect::<Result<Vec<_>, _>>()?;

        let validation_severities = sqlx::query_as::<_, SeverityRow>(
            "SELECT severity, COUNT(*) AS count
             FROM validation_issues WHERE project_id = ? AND status = 'open'
             GROUP BY severity ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END",
        )
        .bind(&project_id_text)
        .fetch_all(&mut *transaction)
        .await?
        .into_iter()
        .map(SeverityMetric::try_from)
        .collect::<Result<Vec<_>, _>>()?;

        let environment_coverage = sqlx::query_as::<_, EnvironmentCoverageRow>(
            "SELECT e.id, e.name,
                (SELECT COUNT(*) FROM environment_key_definitions d WHERE d.project_id = e.project_id) AS known_keys,
                (SELECT COUNT(*) FROM (
                    SELECT o.key_definition_id
                    FROM environment_key_occurrences o
                    WHERE o.project_id = e.project_id
                      AND o.environment_id = e.id
                      AND o.is_commented = 0
                    UNION
                    SELECT k.key_definition_id
                    FROM custom_environment_keys k
                    WHERE k.project_id = e.project_id
                      AND k.environment_id = e.id
                 )) AS present_keys,
                (SELECT COUNT(*) FROM environment_sources s
                 WHERE s.project_id = e.project_id AND s.environment_id = e.id
                   AND s.parse_status IN ('missing', 'unreadable', 'parse_issue', 'unsupported_encoding')) AS unavailable_sources
             FROM environments e
             WHERE e.project_id = ?
             ORDER BY e.sort_order ASC, e.id ASC",
        )
        .bind(&project_id_text)
        .fetch_all(&mut *transaction)
        .await?
        .into_iter()
        .map(EnvironmentCoverage::try_from)
        .collect::<Result<Vec<_>, _>>()?;

        let recent_scans = sqlx::query_as::<_, ScanRow>(
            "SELECT id, scan_type, status, files_discovered, files_added, files_updated,
                    files_missing, entries_unreadable, duration_ms, started_at, completed_at
             FROM scan_runs WHERE project_id = ?
             ORDER BY started_at DESC, id DESC LIMIT ?",
        )
        .bind(&project_id_text)
        .bind(RECENT_SCAN_LIMIT)
        .fetch_all(&mut *transaction)
        .await?
        .into_iter()
        .map(DashboardScan::try_from)
        .collect::<Result<Vec<_>, _>>()?;

        transaction.commit().await?;
        Ok(ProjectDashboard {
            project_id,
            metrics,
            file_categories,
            validation_severities,
            environment_coverage,
            recent_scans,
        })
    }
}

fn to_u64(value: i64) -> Result<u64, DashboardError> {
    value
        .try_into()
        .map_err(|_| DashboardError::InvalidPersistedData)
}

#[derive(Debug, FromRow)]
struct MetricsRow {
    indexed_files: i64,
    missing_files: i64,
    managed_assets: i64,
    environments: i64,
    environment_keys: i64,
    open_validation_issues: i64,
    watched_locations: i64,
    last_scan_at: Option<String>,
}

impl TryFrom<MetricsRow> for DashboardMetrics {
    type Error = DashboardError;

    fn try_from(row: MetricsRow) -> Result<Self, Self::Error> {
        Ok(Self {
            indexed_files: to_u64(row.indexed_files)?,
            missing_files: to_u64(row.missing_files)?,
            managed_assets: to_u64(row.managed_assets)?,
            environments: to_u64(row.environments)?,
            environment_keys: to_u64(row.environment_keys)?,
            open_validation_issues: to_u64(row.open_validation_issues)?,
            watched_locations: to_u64(row.watched_locations)?,
            watcher_status: DashboardWatcherStatus::Unavailable,
            last_scan_at: row.last_scan_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct CategoryRow {
    category: String,
    count: i64,
}

impl TryFrom<CategoryRow> for CategoryMetric {
    type Error = DashboardError;

    fn try_from(row: CategoryRow) -> Result<Self, Self::Error> {
        Ok(Self {
            category: FileCategory::try_from(row.category.as_str())
                .map_err(|_| DashboardError::InvalidPersistedData)?,
            count: to_u64(row.count)?,
        })
    }
}

#[derive(Debug, FromRow)]
struct SeverityRow {
    severity: String,
    count: i64,
}

impl TryFrom<SeverityRow> for SeverityMetric {
    type Error = DashboardError;

    fn try_from(row: SeverityRow) -> Result<Self, Self::Error> {
        Ok(Self {
            severity: DashboardValidationSeverity::try_from(row.severity.as_str())
                .map_err(|_| DashboardError::InvalidPersistedData)?,
            count: to_u64(row.count)?,
        })
    }
}

#[derive(Debug, FromRow)]
struct EnvironmentCoverageRow {
    id: String,
    name: String,
    known_keys: i64,
    present_keys: i64,
    unavailable_sources: i64,
}

impl TryFrom<EnvironmentCoverageRow> for EnvironmentCoverage {
    type Error = DashboardError;

    fn try_from(row: EnvironmentCoverageRow) -> Result<Self, Self::Error> {
        let known_keys = to_u64(row.known_keys)?;
        let present_keys = to_u64(row.present_keys)?;
        Ok(Self {
            environment_id: Uuid::parse_str(&row.id)
                .map_err(|_| DashboardError::InvalidPersistedData)?,
            name: row.name,
            known_keys,
            present_keys,
            coverage_percent: (known_keys > 0)
                .then(|| (present_keys as f64 / known_keys as f64) * 100.0),
            unavailable_sources: to_u64(row.unavailable_sources)?,
        })
    }
}

#[derive(Debug, FromRow)]
struct ScanRow {
    id: String,
    scan_type: String,
    status: String,
    files_discovered: i64,
    files_added: i64,
    files_updated: i64,
    files_missing: i64,
    entries_unreadable: i64,
    duration_ms: i64,
    started_at: String,
    completed_at: Option<String>,
}

impl TryFrom<ScanRow> for DashboardScan {
    type Error = DashboardError;

    fn try_from(row: ScanRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: Uuid::parse_str(&row.id).map_err(|_| DashboardError::InvalidPersistedData)?,
            scan_type: ScanType::try_from(row.scan_type.as_str())
                .map_err(|_| DashboardError::InvalidPersistedData)?,
            status: ScanStatus::try_from(row.status.as_str())
                .map_err(|_| DashboardError::InvalidPersistedData)?,
            files_discovered: to_u64(row.files_discovered)?,
            files_added: to_u64(row.files_added)?,
            files_updated: to_u64(row.files_updated)?,
            files_missing: to_u64(row.files_missing)?,
            entries_unreadable: to_u64(row.entries_unreadable)?,
            duration_ms: to_u64(row.duration_ms)?,
            started_at: row.started_at,
            completed_at: row.completed_at,
        })
    }
}
