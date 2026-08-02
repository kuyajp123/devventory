use std::collections::HashMap;

use sqlx::{FromRow, QueryBuilder, Sqlite, SqlitePool};
use uuid::Uuid;

use super::error::FileInventoryError;
use super::model::{
    FileCategory, FileSourceType, FileStatus, IndexedFile, InventoryPage, InventoryQuery,
    PersistenceSummary, ScanRun, ScanStatus, ScanTraversalSummary, ScanType, ScannedFile,
};

const RECENT_SCAN_LIMIT: u32 = 5;

#[allow(async_fn_in_trait)]
pub(super) trait FileInventoryRepository: Send + Sync {
    async fn start_scan(
        &self,
        project_id: Uuid,
        watched_location_id: Option<Uuid>,
        scan_type: ScanType,
    ) -> Result<Uuid, FileInventoryError>;
    async fn upsert_batch(
        &self,
        project_id: Uuid,
        scan_id: Uuid,
        files: &[ScannedFile],
    ) -> Result<PersistenceSummary, FileInventoryError>;
    async fn finish_scan(
        &self,
        scan_id: Uuid,
        project_id: Uuid,
        watched_location_id: Option<Uuid>,
        traversal: ScanTraversalSummary,
        persistence: PersistenceSummary,
    ) -> Result<ScanRun, FileInventoryError>;
    async fn fail_scan(
        &self,
        scan_id: Uuid,
        error_summary: &'static str,
    ) -> Result<ScanRun, FileInventoryError>;
    async fn query(&self, query: &InventoryQuery) -> Result<InventoryPage, FileInventoryError>;
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteFileInventoryRepository {
    pool: SqlitePool,
}

impl SqliteFileInventoryRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    async fn existing_batch(
        &self,
        project_id: Uuid,
        files: &[ScannedFile],
    ) -> Result<HashMap<String, ExistingFileRow>, FileInventoryError> {
        if files.is_empty() {
            return Ok(HashMap::new());
        }

        let mut builder = QueryBuilder::<Sqlite>::new(
            "SELECT id, relative_path, watched_location_id, name, extension, mime_type, \
             size_bytes, modified_at_ms, category, status \
             FROM indexed_files WHERE project_id = ",
        );
        builder.push_bind(project_id.to_string());
        builder.push(" AND relative_path IN (");
        let mut separated = builder.separated(", ");
        for file in files {
            separated.push_bind(&file.relative_path);
        }
        separated.push_unseparated(")");

        Ok(builder
            .build_query_as::<ExistingFileRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|row| (row.relative_path.clone(), row))
            .collect())
    }

    async fn scan_by_id(&self, scan_id: Uuid) -> Result<ScanRun, FileInventoryError> {
        let row = sqlx::query_as::<_, ScanRunRow>(SCAN_BY_ID_SQL)
            .bind(scan_id.to_string())
            .fetch_one(&self.pool)
            .await?;
        row.try_into()
    }

    async fn recent_scans(&self, project_id: Uuid) -> Result<Vec<ScanRun>, FileInventoryError> {
        sqlx::query_as::<_, ScanRunRow>(
            "SELECT id, project_id, watched_location_id, scan_type, status,
                    files_discovered, files_added, files_updated, files_unchanged,
                    files_missing, directories_visited, entries_excluded,
                    entries_unreadable, duration_ms, error_summary, started_at, completed_at
             FROM scan_runs
             WHERE project_id = ?
             ORDER BY started_at DESC, id DESC
             LIMIT ?",
        )
        .bind(project_id.to_string())
        .bind(i64::from(RECENT_SCAN_LIMIT))
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }
}

impl FileInventoryRepository for SqliteFileInventoryRepository {
    async fn start_scan(
        &self,
        project_id: Uuid,
        watched_location_id: Option<Uuid>,
        scan_type: ScanType,
    ) -> Result<Uuid, FileInventoryError> {
        let scan_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO scan_runs (
                id, project_id, watched_location_id, scan_type, status
             ) VALUES (?, ?, ?, ?, 'running')",
        )
        .bind(scan_id.to_string())
        .bind(project_id.to_string())
        .bind(watched_location_id.map(|id| id.to_string()))
        .bind(scan_type.as_str())
        .execute(&self.pool)
        .await?;
        Ok(scan_id)
    }

    async fn upsert_batch(
        &self,
        project_id: Uuid,
        scan_id: Uuid,
        files: &[ScannedFile],
    ) -> Result<PersistenceSummary, FileInventoryError> {
        if files.is_empty() {
            return Ok(PersistenceSummary::default());
        }

        let existing = self.existing_batch(project_id, files).await?;
        let mut transaction = self.pool.begin().await?;
        let mut summary = PersistenceSummary::default();

        for file in files {
            let size_bytes = to_i64(file.size_bytes)?;
            match existing.get(&file.relative_path) {
                None => {
                    sqlx::query(
                        "INSERT INTO indexed_files (
                            id, project_id, watched_location_id, relative_path, name,
                            extension, mime_type, size_bytes, modified_at_ms, category,
                            source_type, status, last_scan_id
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', 'active', ?)",
                    )
                    .bind(Uuid::new_v4().to_string())
                    .bind(project_id.to_string())
                    .bind(file.watched_location_id.to_string())
                    .bind(&file.relative_path)
                    .bind(&file.name)
                    .bind(&file.extension)
                    .bind(&file.mime_type)
                    .bind(size_bytes)
                    .bind(file.modified_at_ms)
                    .bind(file.category.as_str())
                    .bind(scan_id.to_string())
                    .execute(&mut *transaction)
                    .await?;
                    summary.files_added += 1;
                }
                Some(row) if row.differs_from(file)? => {
                    sqlx::query(
                        "UPDATE indexed_files SET
                            watched_location_id = ?, name = ?, extension = ?, mime_type = ?,
                            size_bytes = ?, modified_at_ms = ?, category = ?, status = 'active',
                            last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                            last_scan_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                         WHERE id = ?",
                    )
                    .bind(file.watched_location_id.to_string())
                    .bind(&file.name)
                    .bind(&file.extension)
                    .bind(&file.mime_type)
                    .bind(size_bytes)
                    .bind(file.modified_at_ms)
                    .bind(file.category.as_str())
                    .bind(scan_id.to_string())
                    .bind(&row.id)
                    .execute(&mut *transaction)
                    .await?;
                    summary.files_updated += 1;
                }
                Some(row) => {
                    sqlx::query(
                        "UPDATE indexed_files SET
                            last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                            last_scan_id = ?
                         WHERE id = ?",
                    )
                    .bind(scan_id.to_string())
                    .bind(&row.id)
                    .execute(&mut *transaction)
                    .await?;
                    summary.files_unchanged += 1;
                }
            }
        }

        transaction.commit().await?;
        Ok(summary)
    }

    async fn finish_scan(
        &self,
        scan_id: Uuid,
        project_id: Uuid,
        watched_location_id: Option<Uuid>,
        traversal: ScanTraversalSummary,
        mut persistence: PersistenceSummary,
    ) -> Result<ScanRun, FileInventoryError> {
        let mut transaction = self.pool.begin().await?;
        let status = if traversal.completed {
            ScanStatus::Completed
        } else {
            ScanStatus::Partial
        };

        if traversal.completed {
            let result = match watched_location_id {
                Some(location_id) => {
                    sqlx::query(
                        "UPDATE indexed_files SET
                            status = 'missing', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                         WHERE project_id = ? AND watched_location_id = ?
                           AND status = 'active' AND last_scan_id <> ?",
                    )
                    .bind(project_id.to_string())
                    .bind(location_id.to_string())
                    .bind(scan_id.to_string())
                    .execute(&mut *transaction)
                    .await?
                }
                None => {
                    sqlx::query(
                        "UPDATE indexed_files SET
                            status = 'missing', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                         WHERE project_id = ? AND status = 'active' AND last_scan_id <> ?",
                    )
                    .bind(project_id.to_string())
                    .bind(scan_id.to_string())
                    .execute(&mut *transaction)
                    .await?
                }
            };
            persistence.files_missing = result.rows_affected();
        }

        sqlx::query(
            "UPDATE scan_runs SET
                status = ?, files_discovered = ?, files_added = ?, files_updated = ?,
                files_unchanged = ?, files_missing = ?, directories_visited = ?,
                entries_excluded = ?, entries_unreadable = ?, duration_ms = ?,
                completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND status = 'running'",
        )
        .bind(status.as_str())
        .bind(to_i64(traversal.files_discovered)?)
        .bind(to_i64(persistence.files_added)?)
        .bind(to_i64(persistence.files_updated)?)
        .bind(to_i64(persistence.files_unchanged)?)
        .bind(to_i64(persistence.files_missing)?)
        .bind(to_i64(traversal.directories_visited)?)
        .bind(to_i64(traversal.entries_excluded)?)
        .bind(to_i64(traversal.entries_unreadable)?)
        .bind(to_i64(traversal.duration_ms)?)
        .bind(scan_id.to_string())
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;

        self.scan_by_id(scan_id).await
    }

    async fn fail_scan(
        &self,
        scan_id: Uuid,
        error_summary: &'static str,
    ) -> Result<ScanRun, FileInventoryError> {
        sqlx::query(
            "UPDATE scan_runs SET
                status = 'failed', error_summary = ?,
                completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND status = 'running'",
        )
        .bind(error_summary)
        .bind(scan_id.to_string())
        .execute(&self.pool)
        .await?;
        self.scan_by_id(scan_id).await
    }

    async fn query(&self, query: &InventoryQuery) -> Result<InventoryPage, FileInventoryError> {
        let mut count_builder = QueryBuilder::<Sqlite>::new(
            "SELECT COUNT(*) AS total FROM indexed_files WHERE project_id = ",
        );
        push_inventory_filters(&mut count_builder, query);
        let total: i64 = count_builder
            .build_query_scalar()
            .fetch_one(&self.pool)
            .await?;
        let total_items = from_i64(total)?;

        let mut item_builder = QueryBuilder::<Sqlite>::new(
            "SELECT id, project_id, watched_location_id, relative_path, name, extension,
                    mime_type, size_bytes, modified_at_ms, category, source_type, status,
                    first_seen_at, last_seen_at, updated_at
             FROM indexed_files WHERE project_id = ",
        );
        push_inventory_filters(&mut item_builder, query);
        item_builder.push(" ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, lower(relative_path), id LIMIT ");
        item_builder.push_bind(i64::from(query.page_size));
        let offset = u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size);
        item_builder.push(" OFFSET ");
        item_builder.push_bind(to_i64(offset)?);
        let items = item_builder
            .build_query_as::<IndexedFileRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(TryInto::try_into)
            .collect::<Result<Vec<_>, FileInventoryError>>()?;
        let total_pages_u64 = total_items.div_ceil(u64::from(query.page_size));
        let total_pages =
            u32::try_from(total_pages_u64).map_err(|_| FileInventoryError::InvalidPersistedData)?;

        Ok(InventoryPage {
            items,
            total_items,
            page: query.page,
            page_size: query.page_size,
            total_pages,
            recent_scans: self.recent_scans(query.project_id).await?,
            watched_locations: Vec::new(),
        })
    }
}

fn push_inventory_filters(builder: &mut QueryBuilder<Sqlite>, query: &InventoryQuery) {
    builder.push_bind(query.project_id.to_string());
    if let Some(search) = &query.search {
        let pattern = format!("%{}%", escape_like(search));
        builder.push(" AND (lower(name) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") ESCAPE '\\' OR lower(relative_path) LIKE lower(");
        builder.push_bind(pattern);
        builder.push(") ESCAPE '\\')");
    }
    if let Some(category) = query.category {
        builder.push(" AND category = ");
        builder.push_bind(category.as_str());
    }
    if let Some(extension) = &query.extension {
        builder.push(" AND extension = ");
        builder.push_bind(extension);
    }
    if let Some(status) = query.status {
        builder.push(" AND status = ");
        builder.push_bind(status.as_str());
    }
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

#[derive(Debug, FromRow)]
struct ExistingFileRow {
    id: String,
    relative_path: String,
    watched_location_id: Option<String>,
    name: String,
    extension: Option<String>,
    mime_type: Option<String>,
    size_bytes: i64,
    modified_at_ms: Option<i64>,
    category: String,
    status: String,
}

impl ExistingFileRow {
    fn differs_from(&self, file: &ScannedFile) -> Result<bool, FileInventoryError> {
        Ok(self.watched_location_id.as_deref()
            != Some(file.watched_location_id.to_string()).as_deref()
            || self.name != file.name
            || self.extension != file.extension
            || self.mime_type != file.mime_type
            || from_i64(self.size_bytes)? != file.size_bytes
            || self.modified_at_ms != file.modified_at_ms
            || self.category != file.category.as_str()
            || self.status != "active")
    }
}

#[derive(Debug, FromRow)]
struct IndexedFileRow {
    id: String,
    project_id: String,
    watched_location_id: Option<String>,
    relative_path: String,
    name: String,
    extension: Option<String>,
    mime_type: Option<String>,
    size_bytes: i64,
    modified_at_ms: Option<i64>,
    category: String,
    source_type: String,
    status: String,
    first_seen_at: String,
    last_seen_at: String,
    updated_at: String,
}

impl TryFrom<IndexedFileRow> for IndexedFile {
    type Error = FileInventoryError;

    fn try_from(row: IndexedFileRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            watched_location_id: row
                .watched_location_id
                .as_deref()
                .map(parse_uuid)
                .transpose()?,
            relative_path: row.relative_path,
            name: row.name,
            extension: row.extension,
            mime_type: row.mime_type,
            size_bytes: from_i64(row.size_bytes)?,
            modified_at_ms: row.modified_at_ms,
            category: FileCategory::try_from(row.category.as_str())?,
            source_type: FileSourceType::try_from(row.source_type.as_str())?,
            status: FileStatus::try_from(row.status.as_str())?,
            first_seen_at: row.first_seen_at,
            last_seen_at: row.last_seen_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct ScanRunRow {
    id: String,
    project_id: String,
    watched_location_id: Option<String>,
    scan_type: String,
    status: String,
    files_discovered: i64,
    files_added: i64,
    files_updated: i64,
    files_unchanged: i64,
    files_missing: i64,
    directories_visited: i64,
    entries_excluded: i64,
    entries_unreadable: i64,
    duration_ms: i64,
    error_summary: Option<String>,
    started_at: String,
    completed_at: Option<String>,
}

impl TryFrom<ScanRunRow> for ScanRun {
    type Error = FileInventoryError;

    fn try_from(row: ScanRunRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            watched_location_id: row
                .watched_location_id
                .as_deref()
                .map(parse_uuid)
                .transpose()?,
            scan_type: ScanType::try_from(row.scan_type.as_str())?,
            status: ScanStatus::try_from(row.status.as_str())?,
            files_discovered: from_i64(row.files_discovered)?,
            files_added: from_i64(row.files_added)?,
            files_updated: from_i64(row.files_updated)?,
            files_unchanged: from_i64(row.files_unchanged)?,
            files_missing: from_i64(row.files_missing)?,
            directories_visited: from_i64(row.directories_visited)?,
            entries_excluded: from_i64(row.entries_excluded)?,
            entries_unreadable: from_i64(row.entries_unreadable)?,
            duration_ms: from_i64(row.duration_ms)?,
            error_summary: row.error_summary,
            started_at: row.started_at,
            completed_at: row.completed_at,
        })
    }
}

const SCAN_BY_ID_SQL: &str = "SELECT
        id, project_id, watched_location_id, scan_type, status,
        files_discovered, files_added, files_updated, files_unchanged,
        files_missing, directories_visited, entries_excluded,
        entries_unreadable, duration_ms, error_summary, started_at, completed_at
     FROM scan_runs WHERE id = ?";

fn parse_uuid(value: &str) -> Result<Uuid, FileInventoryError> {
    Uuid::parse_str(value).map_err(|_| FileInventoryError::InvalidPersistedData)
}

fn to_i64(value: u64) -> Result<i64, FileInventoryError> {
    i64::try_from(value).map_err(|_| FileInventoryError::InvalidPersistedData)
}

fn from_i64(value: i64) -> Result<u64, FileInventoryError> {
    u64::try_from(value).map_err(|_| FileInventoryError::InvalidPersistedData)
}
