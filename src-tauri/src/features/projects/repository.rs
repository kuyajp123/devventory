use sqlx::{query, query_as, FromRow, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use super::error::ProjectError;
use super::exclusions::is_built_in_exclusion;
use super::model::{
    InitialScanSummary, NewProjectRecord, Project, ProjectScanTarget, ProjectType,
    WatchedLocationScanTarget,
};

#[allow(async_fn_in_trait)]
pub(super) trait ProjectRepository: Send + Sync {
    async fn create(&self, record: NewProjectRecord) -> Result<Project, ProjectError>;
    async fn delete(&self, id: Uuid) -> Result<bool, ProjectError>;
    async fn exists_by_root_key(&self, root_key: &str) -> Result<bool, ProjectError>;
    async fn find_all(&self) -> Result<Vec<Project>, ProjectError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Project>, ProjectError>;
    async fn find_scan_target(&self, id: Uuid) -> Result<Option<ProjectScanTarget>, ProjectError>;
    async fn find_scan_targets(&self) -> Result<Vec<ProjectScanTarget>, ProjectError>;
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteProjectRepository {
    pool: SqlitePool,
}

impl SqliteProjectRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    async fn insert_project(
        transaction: &mut Transaction<'_, Sqlite>,
        record: &NewProjectRecord,
    ) -> Result<(), ProjectError> {
        let result = query(
            "INSERT INTO projects (
                id, name, description, project_type, root_path, root_path_key
             ) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(record.id.to_string())
        .bind(&record.name)
        .bind(&record.description)
        .bind(record.project_type.as_str())
        .bind(&record.root_path)
        .bind(&record.root_path_key)
        .execute(&mut **transaction)
        .await;

        match result {
            Ok(_) => Ok(()),
            Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
                Err(ProjectError::DuplicateRoot)
            }
            Err(error) => Err(ProjectError::Database(error)),
        }
    }

    async fn insert_children(
        transaction: &mut Transaction<'_, Sqlite>,
        record: &NewProjectRecord,
    ) -> Result<(), ProjectError> {
        let project_id = record.id.to_string();

        for relative_path in &record.watched_locations {
            query(
                "INSERT INTO watched_locations (id, project_id, relative_path)
                 VALUES (?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&project_id)
            .bind(relative_path)
            .execute(&mut **transaction)
            .await?;
        }

        for relative_pattern in &record.exclusions {
            query(
                "INSERT INTO project_exclusions (id, project_id, relative_pattern)
                 VALUES (?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&project_id)
            .bind(relative_pattern)
            .execute(&mut **transaction)
            .await?;
        }

        query(
            "INSERT INTO initial_scan_summaries (
                id, project_id, files_discovered, directories_visited,
                entries_excluded, entries_unreadable, duration_ms, completed
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(project_id)
        .bind(to_database_integer(record.initial_scan.files_discovered)?)
        .bind(to_database_integer(
            record.initial_scan.directories_visited,
        )?)
        .bind(to_database_integer(record.initial_scan.entries_excluded)?)
        .bind(to_database_integer(record.initial_scan.entries_unreadable)?)
        .bind(to_database_integer(record.initial_scan.duration_ms)?)
        .bind(record.initial_scan.completed)
        .execute(&mut **transaction)
        .await?;

        Ok(())
    }

    async fn hydrate(&self, row: ProjectRow) -> Result<Project, ProjectError> {
        let watched_locations = query_as::<_, RelativePathRow>(
            "SELECT relative_path AS value
             FROM watched_locations
             WHERE project_id = ?
             ORDER BY relative_path",
        )
        .bind(&row.id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|item| item.value)
        .collect();
        let exclusions = query_as::<_, RelativePathRow>(
            "SELECT relative_pattern AS value
             FROM project_exclusions
             WHERE project_id = ?
             ORDER BY relative_pattern",
        )
        .bind(&row.id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|item| item.value)
        .filter(|value| !is_built_in_exclusion(value))
        .collect();

        Ok(Project {
            id: Uuid::parse_str(&row.id).map_err(|_| ProjectError::InvalidPersistedData)?,
            name: row.name,
            description: row.description,
            project_type: ProjectType::try_from(row.project_type.as_str())
                .map_err(|_| ProjectError::InvalidPersistedData)?,
            root_path: row.root_path,
            created_at: row.created_at,
            updated_at: row.updated_at,
            watched_locations,
            exclusions,
            initial_scan: InitialScanSummary {
                files_discovered: from_database_integer(row.files_discovered)?,
                directories_visited: from_database_integer(row.directories_visited)?,
                entries_excluded: from_database_integer(row.entries_excluded)?,
                entries_unreadable: from_database_integer(row.entries_unreadable)?,
                duration_ms: from_database_integer(row.duration_ms)?,
                completed: row.completed,
            },
        })
    }

    async fn hydrate_scan_target(
        &self,
        row: ProjectScanTargetRow,
    ) -> Result<ProjectScanTarget, ProjectError> {
        let watched_locations = query_as::<_, WatchedLocationRow>(
            "SELECT id, relative_path
             FROM watched_locations
             WHERE project_id = ?
             ORDER BY relative_path",
        )
        .bind(&row.id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|location| {
            Ok(WatchedLocationScanTarget {
                id: Uuid::parse_str(&location.id)
                    .map_err(|_| ProjectError::InvalidPersistedData)?,
                relative_path: location.relative_path,
            })
        })
        .collect::<Result<Vec<_>, ProjectError>>()?;
        let exclusions = query_as::<_, RelativePathRow>(
            "SELECT relative_pattern AS value
             FROM project_exclusions
             WHERE project_id = ?
             ORDER BY relative_pattern",
        )
        .bind(&row.id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|item| item.value)
        .filter(|value| !is_built_in_exclusion(value))
        .collect();

        Ok(ProjectScanTarget {
            id: Uuid::parse_str(&row.id).map_err(|_| ProjectError::InvalidPersistedData)?,
            root_path: row.root_path,
            watched_locations,
            exclusions,
        })
    }
}

impl ProjectRepository for SqliteProjectRepository {
    async fn create(&self, record: NewProjectRecord) -> Result<Project, ProjectError> {
        let id = record.id;
        let mut transaction = self.pool.begin().await?;
        Self::insert_project(&mut transaction, &record).await?;
        Self::insert_children(&mut transaction, &record).await?;
        transaction.commit().await?;

        self.find_by_id(id)
            .await?
            .ok_or(ProjectError::InvalidPersistedData)
    }

    async fn delete(&self, id: Uuid) -> Result<bool, ProjectError> {
        let result = query("DELETE FROM projects WHERE id = ?")
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() == 1)
    }

    async fn exists_by_root_key(&self, root_key: &str) -> Result<bool, ProjectError> {
        let exists = query_as::<_, ExistsRow>(
            "SELECT EXISTS(
                SELECT 1 FROM projects WHERE root_path_key = ?
             ) AS found",
        )
        .bind(root_key)
        .fetch_one(&self.pool)
        .await?;

        Ok(exists.found)
    }

    async fn find_all(&self) -> Result<Vec<Project>, ProjectError> {
        let rows = query_as::<_, ProjectRow>(PROJECT_LIST_SQL)
            .fetch_all(&self.pool)
            .await?;
        let mut projects = Vec::with_capacity(rows.len());
        for row in rows {
            projects.push(self.hydrate(row).await?);
        }
        Ok(projects)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Project>, ProjectError> {
        let row = query_as::<_, ProjectRow>(PROJECT_BY_ID_SQL)
            .bind(id.to_string())
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => Ok(Some(self.hydrate(row).await?)),
            None => Ok(None),
        }
    }

    async fn find_scan_target(&self, id: Uuid) -> Result<Option<ProjectScanTarget>, ProjectError> {
        let row =
            query_as::<_, ProjectScanTargetRow>("SELECT id, root_path FROM projects WHERE id = ?")
                .bind(id.to_string())
                .fetch_optional(&self.pool)
                .await?;

        match row {
            Some(row) => Ok(Some(self.hydrate_scan_target(row).await?)),
            None => Ok(None),
        }
    }

    async fn find_scan_targets(&self) -> Result<Vec<ProjectScanTarget>, ProjectError> {
        let rows = query_as::<_, ProjectScanTargetRow>(
            "SELECT id, root_path FROM projects ORDER BY created_at, id",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut targets = Vec::with_capacity(rows.len());
        for row in rows {
            targets.push(self.hydrate_scan_target(row).await?);
        }
        Ok(targets)
    }
}

const PROJECT_LIST_SQL: &str = "SELECT
        p.id,
        p.name,
        p.description,
        p.project_type,
        p.root_path,
        p.created_at,
        p.updated_at,
        s.files_discovered,
        s.directories_visited,
        s.entries_excluded,
        s.entries_unreadable,
        s.duration_ms,
        s.completed
     FROM projects p
     INNER JOIN initial_scan_summaries s ON s.project_id = p.id
     ORDER BY p.updated_at DESC";

const PROJECT_BY_ID_SQL: &str = "SELECT
        p.id,
        p.name,
        p.description,
        p.project_type,
        p.root_path,
        p.created_at,
        p.updated_at,
        s.files_discovered,
        s.directories_visited,
        s.entries_excluded,
        s.entries_unreadable,
        s.duration_ms,
        s.completed
     FROM projects p
     INNER JOIN initial_scan_summaries s ON s.project_id = p.id
     WHERE p.id = ?";

#[derive(Debug, FromRow)]
struct ProjectRow {
    id: String,
    name: String,
    description: Option<String>,
    project_type: String,
    root_path: String,
    created_at: String,
    updated_at: String,
    files_discovered: i64,
    directories_visited: i64,
    entries_excluded: i64,
    entries_unreadable: i64,
    duration_ms: i64,
    completed: bool,
}

#[derive(Debug, FromRow)]
struct RelativePathRow {
    value: String,
}

#[derive(Debug, FromRow)]
struct WatchedLocationRow {
    id: String,
    relative_path: String,
}

#[derive(Debug, FromRow)]
struct ProjectScanTargetRow {
    id: String,
    root_path: String,
}

#[derive(Debug, FromRow)]
struct ExistsRow {
    found: bool,
}

fn to_database_integer(value: u64) -> Result<i64, ProjectError> {
    i64::try_from(value).map_err(|_| ProjectError::InvalidPersistedData)
}

fn from_database_integer(value: i64) -> Result<u64, ProjectError> {
    u64::try_from(value).map_err(|_| ProjectError::InvalidPersistedData)
}
