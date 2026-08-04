use std::collections::{HashMap, HashSet};

use sqlx::{FromRow, QueryBuilder, Sqlite, SqlitePool};
use uuid::Uuid;

use super::error::EnvironmentError;
use super::model::{
    Environment, EnvironmentDraft, EnvironmentSource, EnvironmentUpdate, MatrixCell,
    MatrixCellState, MatrixColumn, MatrixOccurrence, MatrixPage, MatrixQuery, MatrixRow,
    ParseIssue, ParseStatus, ParsedEnvironmentFile, SourceCandidate, SourceCandidatePage,
    SourceCandidateQuery, SourceDraft, SourceStatus,
};

#[derive(Debug, Clone)]
pub(crate) struct SqliteEnvironmentRepository {
    pool: SqlitePool,
}

impl SqliteEnvironmentRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub(crate) async fn list(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<Environment>, EnvironmentError> {
        let environment_rows = sqlx::query_as::<_, EnvironmentRow>(
            "SELECT id, project_id, name, description, sort_order, created_at, updated_at
             FROM environments WHERE project_id = ? ORDER BY sort_order, lower(name)",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        let source_rows = sqlx::query_as::<_, SourceRow>(
            "SELECT id, project_id, environment_id, relative_path, priority, status,
                    parse_status, size_bytes, modified_at_ms, issue_count, last_parsed_at,
                    created_at, updated_at
             FROM environment_sources WHERE project_id = ?
             ORDER BY environment_id, priority, lower(relative_path)",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        let mut sources_by_environment: HashMap<Uuid, Vec<EnvironmentSource>> = HashMap::new();
        for row in source_rows {
            let source = EnvironmentSource::try_from(row)?;
            sources_by_environment
                .entry(source.environment_id)
                .or_default()
                .push(source);
        }

        environment_rows
            .into_iter()
            .map(|row| {
                let mut environment = Environment::try_from(row)?;
                environment.sources = sources_by_environment
                    .remove(&environment.id)
                    .unwrap_or_default();
                Ok(environment)
            })
            .collect()
    }

    pub(crate) async fn create(
        &self,
        draft: &EnvironmentDraft,
    ) -> Result<Environment, EnvironmentError> {
        let id = Uuid::new_v4();
        let result = sqlx::query(
            "INSERT INTO environments (
                id, project_id, name, normalized_name, description, sort_order
             ) VALUES (
                ?, ?, ?, ?, ?,
                COALESCE((SELECT MAX(sort_order) + 1 FROM environments WHERE project_id = ?), 0)
             )",
        )
        .bind(id.to_string())
        .bind(draft.project_id.to_string())
        .bind(&draft.name)
        .bind(&draft.normalized_name)
        .bind(&draft.description)
        .bind(draft.project_id.to_string())
        .execute(&self.pool)
        .await;
        map_unique_name(result)?;
        self.get_environment(draft.project_id, id).await
    }

    pub(crate) async fn update(
        &self,
        update: &EnvironmentUpdate,
    ) -> Result<Environment, EnvironmentError> {
        let result = sqlx::query(
            "UPDATE environments SET name = ?, normalized_name = ?, description = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND project_id = ?",
        )
        .bind(&update.name)
        .bind(&update.normalized_name)
        .bind(&update.description)
        .bind(update.environment_id.to_string())
        .bind(update.project_id.to_string())
        .execute(&self.pool)
        .await;
        let result = map_unique_name(result)?;
        if result.rows_affected() == 0 {
            return Err(EnvironmentError::NotFound);
        }
        self.get_environment(update.project_id, update.environment_id)
            .await
    }

    pub(crate) async fn delete(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        let mut transaction = self.pool.begin().await?;
        let current_order: Option<i64> = sqlx::query_scalar(
            "SELECT sort_order FROM environments WHERE id = ? AND project_id = ?",
        )
        .bind(environment_id.to_string())
        .bind(project_id.to_string())
        .fetch_optional(&mut *transaction)
        .await?;
        let Some(current_order) = current_order else {
            return Err(EnvironmentError::NotFound);
        };
        sqlx::query("DELETE FROM environments WHERE id = ? AND project_id = ?")
            .bind(environment_id.to_string())
            .bind(project_id.to_string())
            .execute(&mut *transaction)
            .await?;
        sqlx::query(
            "UPDATE environments SET sort_order = sort_order - 1,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE project_id = ? AND sort_order > ?",
        )
        .bind(project_id.to_string())
        .bind(current_order)
        .execute(&mut *transaction)
        .await?;
        cleanup_unused_keys(&mut transaction, project_id).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn reorder_environments(
        &self,
        project_id: Uuid,
        ordered_ids: &[Uuid],
    ) -> Result<Vec<Environment>, EnvironmentError> {
        let existing = sqlx::query_scalar::<_, String>(
            "SELECT id FROM environments WHERE project_id = ? ORDER BY sort_order",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        validate_exact_ids(&existing, ordered_ids)?;

        let mut transaction = self.pool.begin().await?;
        sqlx::query(
            "UPDATE environments SET sort_order = sort_order + 1000000 WHERE project_id = ?",
        )
        .bind(project_id.to_string())
        .execute(&mut *transaction)
        .await?;
        for (index, id) in ordered_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE environments SET sort_order = ?,
                        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ? AND project_id = ?",
            )
            .bind(to_i64(index)?)
            .bind(id.to_string())
            .bind(project_id.to_string())
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        self.list(project_id).await
    }

    pub(crate) async fn add_source(
        &self,
        draft: &SourceDraft,
    ) -> Result<EnvironmentSource, EnvironmentError> {
        let result = sqlx::query(
            "INSERT INTO environment_sources (
                id, project_id, environment_id, relative_path, canonical_path_key, priority
             )
             SELECT ?, ?, ?, ?, ?,
                    COALESCE((SELECT MAX(priority) + 1 FROM environment_sources WHERE environment_id = ?), 0)
             WHERE EXISTS (
                SELECT 1 FROM environments WHERE id = ? AND project_id = ?
             )",
        )
        .bind(draft.id.to_string())
        .bind(draft.project_id.to_string())
        .bind(draft.environment_id.to_string())
        .bind(&draft.relative_path)
        .bind(&draft.canonical_path_key)
        .bind(draft.environment_id.to_string())
        .bind(draft.environment_id.to_string())
        .bind(draft.project_id.to_string())
        .execute(&self.pool)
        .await;
        let result = match result {
            Ok(result) => result,
            Err(error) if is_unique_violation(&error) => {
                return Err(EnvironmentError::InvalidInput)
            }
            Err(error) => return Err(error.into()),
        };
        if result.rows_affected() == 0 {
            return Err(EnvironmentError::NotFound);
        }
        self.get_source(draft.project_id, draft.id).await
    }

    pub(crate) async fn remove_source(
        &self,
        project_id: Uuid,
        source_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        let mut transaction = self.pool.begin().await?;
        let row = sqlx::query_as::<_, SourceOrderRow>(
            "SELECT environment_id, priority FROM environment_sources
             WHERE id = ? AND project_id = ?",
        )
        .bind(source_id.to_string())
        .bind(project_id.to_string())
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or(EnvironmentError::NotFound)?;
        sqlx::query("DELETE FROM environment_sources WHERE id = ? AND project_id = ?")
            .bind(source_id.to_string())
            .bind(project_id.to_string())
            .execute(&mut *transaction)
            .await?;
        sqlx::query(
            "UPDATE environment_sources SET priority = priority - 1,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE environment_id = ? AND priority > ?",
        )
        .bind(&row.environment_id)
        .bind(row.priority)
        .execute(&mut *transaction)
        .await?;
        recalculate_duplicates(&mut transaction, &row.environment_id).await?;
        cleanup_unused_keys(&mut transaction, project_id).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn reorder_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        ordered_ids: &[Uuid],
    ) -> Result<Vec<EnvironmentSource>, EnvironmentError> {
        let existing = sqlx::query_scalar::<_, String>(
            "SELECT id FROM environment_sources
             WHERE project_id = ? AND environment_id = ? ORDER BY priority",
        )
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        validate_exact_ids(&existing, ordered_ids)?;

        let mut transaction = self.pool.begin().await?;
        sqlx::query(
            "UPDATE environment_sources SET priority = priority + 1000000
             WHERE project_id = ? AND environment_id = ?",
        )
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .execute(&mut *transaction)
        .await?;
        for (index, id) in ordered_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE environment_sources SET priority = ?,
                        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ? AND project_id = ? AND environment_id = ?",
            )
            .bind(to_i64(index)?)
            .bind(id.to_string())
            .bind(project_id.to_string())
            .bind(environment_id.to_string())
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(self
            .get_environment(project_id, environment_id)
            .await?
            .sources)
    }

    pub(crate) async fn get_source(
        &self,
        project_id: Uuid,
        source_id: Uuid,
    ) -> Result<EnvironmentSource, EnvironmentError> {
        let row = sqlx::query_as::<_, SourceRow>(
            "SELECT id, project_id, environment_id, relative_path, priority, status,
                    parse_status, size_bytes, modified_at_ms, issue_count, last_parsed_at,
                    created_at, updated_at
             FROM environment_sources WHERE id = ? AND project_id = ?",
        )
        .bind(source_id.to_string())
        .bind(project_id.to_string())
        .fetch_optional(&self.pool)
        .await?
        .ok_or(EnvironmentError::NotFound)?;
        row.try_into()
    }

    pub(crate) async fn sources_for_environment(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<Vec<EnvironmentSource>, EnvironmentError> {
        sqlx::query_as::<_, SourceRow>(
            "SELECT id, project_id, environment_id, relative_path, priority, status,
                    parse_status, size_bytes, modified_at_ms, issue_count, last_parsed_at,
                    created_at, updated_at
             FROM environment_sources
             WHERE project_id = ? AND environment_id = ? ORDER BY priority",
        )
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn sources_for_project(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<EnvironmentSource>, EnvironmentError> {
        sqlx::query_as::<_, SourceRow>(
            "SELECT id, project_id, environment_id, relative_path, priority, status,
                    parse_status, size_bytes, modified_at_ms, issue_count, last_parsed_at,
                    created_at, updated_at
             FROM environment_sources WHERE project_id = ?
             ORDER BY environment_id, priority",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn source_candidates(
        &self,
        query: &SourceCandidateQuery,
    ) -> Result<SourceCandidatePage, EnvironmentError> {
        let mut count =
            QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM indexed_files WHERE project_id = ");
        push_candidate_filters(&mut count, query);
        let total: i64 = count.build_query_scalar().fetch_one(&self.pool).await?;
        let total_items = from_i64(total)?;

        let mut items = QueryBuilder::<Sqlite>::new(
            "SELECT id, relative_path, name, status FROM indexed_files WHERE project_id = ",
        );
        push_candidate_filters(&mut items, query);
        items.push(" ORDER BY CASE WHEN lower(name) LIKE '.env%' THEN 0 ELSE 1 END, lower(relative_path) LIMIT ");
        items.push_bind(i64::from(query.page_size));
        items.push(" OFFSET ");
        items.push_bind(to_i64(
            u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size),
        )?);
        let rows = items
            .build_query_as::<SourceCandidateRow>()
            .fetch_all(&self.pool)
            .await?;
        let total_pages = u32::try_from(total_items.div_ceil(u64::from(query.page_size)))
            .map_err(|_| EnvironmentError::InvalidPersistedData)?;
        Ok(SourceCandidatePage {
            items: rows
                .into_iter()
                .map(|row| {
                    Ok(SourceCandidate {
                        id: parse_uuid(&row.id)?,
                        relative_path: row.relative_path,
                        name: row.name,
                        status: row.status,
                    })
                })
                .collect::<Result<_, EnvironmentError>>()?,
            total_items,
            page: query.page,
            page_size: query.page_size,
            total_pages,
        })
    }

    pub(crate) async fn replace_source_parse(
        &self,
        source: &EnvironmentSource,
        parsed: &ParsedEnvironmentFile,
        size_bytes: u64,
        modified_at_ms: Option<i64>,
    ) -> Result<(), EnvironmentError> {
        let mut transaction = self.pool.begin().await?;
        sqlx::query("DELETE FROM environment_key_occurrences WHERE source_id = ?")
            .bind(source.id.to_string())
            .execute(&mut *transaction)
            .await?;
        sqlx::query("DELETE FROM environment_parse_issues WHERE source_id = ?")
            .bind(source.id.to_string())
            .execute(&mut *transaction)
            .await?;

        for occurrence in &parsed.occurrences {
            let key_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO environment_key_definitions (
                    id, project_id, name, normalized_name
                 ) VALUES (?, ?, ?, ?)
                 ON CONFLICT(project_id, normalized_name) DO UPDATE SET
                    name = excluded.name,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            )
            .bind(key_id.to_string())
            .bind(source.project_id.to_string())
            .bind(&occurrence.key_name)
            .bind(&occurrence.normalized_name)
            .execute(&mut *transaction)
            .await?;
            let persisted_key_id: String = sqlx::query_scalar(
                "SELECT id FROM environment_key_definitions
                 WHERE project_id = ? AND normalized_name = ?",
            )
            .bind(source.project_id.to_string())
            .bind(&occurrence.normalized_name)
            .fetch_one(&mut *transaction)
            .await?;
            sqlx::query(
                "INSERT INTO environment_key_occurrences (
                    id, key_definition_id, environment_id, source_id, line_number,
                    commented, duplicate, parse_status
                 ) VALUES (?, ?, ?, ?, ?, ?, 0, 'parsed')",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(persisted_key_id)
            .bind(source.environment_id.to_string())
            .bind(source.id.to_string())
            .bind(i64::from(occurrence.line_number))
            .bind(if occurrence.commented { 1_i64 } else { 0_i64 })
            .execute(&mut *transaction)
            .await?;
        }
        for issue in &parsed.issues {
            sqlx::query(
                "INSERT INTO environment_parse_issues (
                    id, source_id, line_number, issue_code, sanitized_message
                 ) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(source.id.to_string())
            .bind(i64::from(issue.line_number))
            .bind(issue.issue_code)
            .bind(issue.message)
            .execute(&mut *transaction)
            .await?;
        }
        sqlx::query(
            "UPDATE environment_sources SET status = 'ready', parse_status = 'parsed',
                    size_bytes = ?, modified_at_ms = ?, issue_count = ?,
                    last_parsed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND project_id = ?",
        )
        .bind(to_i64(size_bytes)?)
        .bind(modified_at_ms)
        .bind(to_i64(parsed.issues.len())?)
        .bind(source.id.to_string())
        .bind(source.project_id.to_string())
        .execute(&mut *transaction)
        .await?;
        let environment_id = source.environment_id.to_string();
        recalculate_duplicates(&mut transaction, &environment_id).await?;
        cleanup_unused_keys(&mut transaction, source.project_id).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn mark_source_unavailable(
        &self,
        project_id: Uuid,
        source_id: Uuid,
        status: SourceStatus,
    ) -> Result<(), EnvironmentError> {
        sqlx::query(
            "UPDATE environment_sources SET status = ?, parse_status = 'failed',
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND project_id = ?",
        )
        .bind(status.as_str())
        .bind(source_id.to_string())
        .bind(project_id.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub(crate) async fn matrix(&self, query: &MatrixQuery) -> Result<MatrixPage, EnvironmentError> {
        let columns = sqlx::query_as::<_, MatrixColumnRow>(
            "SELECT id, name, sort_order FROM environments
             WHERE project_id = ? ORDER BY sort_order",
        )
        .bind(query.project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect::<Result<Vec<MatrixColumn>, EnvironmentError>>()?;

        let mut count = QueryBuilder::<Sqlite>::new(
            "SELECT COUNT(*) FROM environment_key_definitions WHERE project_id = ",
        );
        push_matrix_filter(&mut count, query);
        let total: i64 = count.build_query_scalar().fetch_one(&self.pool).await?;
        let total_items = from_i64(total)?;

        let mut keys = QueryBuilder::<Sqlite>::new(
            "SELECT id, name FROM environment_key_definitions WHERE project_id = ",
        );
        push_matrix_filter(&mut keys, query);
        keys.push(" ORDER BY lower(name), id LIMIT ");
        keys.push_bind(i64::from(query.page_size));
        keys.push(" OFFSET ");
        keys.push_bind(to_i64(
            u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size),
        )?);
        let key_rows = keys
            .build_query_as::<KeyDefinitionRow>()
            .fetch_all(&self.pool)
            .await?;
        let key_ids = key_rows
            .iter()
            .map(|row| row.id.clone())
            .collect::<Vec<_>>();

        let occurrences = if key_ids.is_empty() {
            Vec::new()
        } else {
            let mut builder = QueryBuilder::<Sqlite>::new(
                "SELECT o.key_definition_id, o.environment_id, o.source_id,
                        s.relative_path, o.line_number, s.priority, o.commented, o.duplicate
                 FROM environment_key_occurrences o
                 JOIN environment_sources s ON s.id = o.source_id
                 WHERE s.project_id = ",
            );
            builder.push_bind(query.project_id.to_string());
            builder.push(" AND o.key_definition_id IN (");
            let mut separated = builder.separated(", ");
            for id in &key_ids {
                separated.push_bind(id);
            }
            separated.push_unseparated(") ORDER BY s.priority, o.line_number");
            builder
                .build_query_as::<MatrixOccurrenceRow>()
                .fetch_all(&self.pool)
                .await?
        };
        let source_health = sqlx::query_as::<_, SourceHealthRow>(
            "SELECT environment_id,
                    MAX(CASE WHEN status IN ('missing', 'unreadable') THEN 1 ELSE 0 END) AS unavailable,
                    MAX(CASE WHEN status = 'parse_error' OR issue_count > 0 THEN 1 ELSE 0 END) AS has_issue
             FROM environment_sources WHERE project_id = ? GROUP BY environment_id",
        )
        .bind(query.project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|row| (row.environment_id, (row.unavailable != 0, row.has_issue != 0)))
        .collect::<HashMap<_, _>>();

        let mut by_key_and_environment: HashMap<(String, String), Vec<MatrixOccurrence>> =
            HashMap::new();
        for row in occurrences {
            let occurrence = MatrixOccurrence {
                source_id: parse_uuid(&row.source_id)?,
                relative_path: row.relative_path,
                line_number: from_i64_u32(row.line_number)?,
                source_priority: from_i64_u32(row.priority)?,
                commented: row.commented != 0,
                duplicate: row.duplicate != 0,
            };
            by_key_and_environment
                .entry((row.key_definition_id, row.environment_id))
                .or_default()
                .push(occurrence);
        }

        let rows = key_rows
            .into_iter()
            .map(|key| {
                let key_id = parse_uuid(&key.id)?;
                let cells = columns
                    .iter()
                    .map(|column| {
                        let environment_key = column.environment_id.to_string();
                        let occurrences = by_key_and_environment
                            .remove(&(key.id.clone(), environment_key.clone()))
                            .unwrap_or_default();
                        let health = source_health
                            .get(&environment_key)
                            .copied()
                            .unwrap_or((false, false));
                        let duplicate_count = u32::try_from(occurrences.len())
                            .map_err(|_| EnvironmentError::InvalidPersistedData)?;
                        let state = if duplicate_count > 1
                            || occurrences.iter().any(|occurrence| occurrence.duplicate)
                        {
                            MatrixCellState::Duplicate
                        } else if !occurrences.is_empty()
                            && occurrences.iter().all(|occurrence| occurrence.commented)
                        {
                            MatrixCellState::Commented
                        } else if !occurrences.is_empty() {
                            MatrixCellState::Present
                        } else if health.0 {
                            MatrixCellState::SourceUnreadable
                        } else if health.1 {
                            MatrixCellState::ParseIssue
                        } else {
                            MatrixCellState::Absent
                        };
                        Ok(MatrixCell {
                            environment_id: column.environment_id,
                            state,
                            duplicate_count,
                            occurrences,
                        })
                    })
                    .collect::<Result<Vec<_>, EnvironmentError>>()?;
                Ok(MatrixRow {
                    key_definition_id: key_id,
                    key_name: key.name,
                    cells,
                })
            })
            .collect::<Result<Vec<_>, EnvironmentError>>()?;

        let total_pages = u32::try_from(total_items.div_ceil(u64::from(query.page_size)))
            .map_err(|_| EnvironmentError::InvalidPersistedData)?;
        Ok(MatrixPage {
            columns,
            rows,
            total_items,
            page: query.page,
            page_size: query.page_size,
            total_pages,
        })
    }

    async fn get_environment(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<Environment, EnvironmentError> {
        let row = sqlx::query_as::<_, EnvironmentRow>(
            "SELECT id, project_id, name, description, sort_order, created_at, updated_at
             FROM environments WHERE id = ? AND project_id = ?",
        )
        .bind(environment_id.to_string())
        .bind(project_id.to_string())
        .fetch_optional(&self.pool)
        .await?
        .ok_or(EnvironmentError::NotFound)?;
        let mut environment = Environment::try_from(row)?;
        environment.sources = self
            .sources_for_environment(project_id, environment_id)
            .await?;
        Ok(environment)
    }
}

fn push_candidate_filters(builder: &mut QueryBuilder<Sqlite>, query: &SourceCandidateQuery) {
    builder.push_bind(query.project_id.to_string());
    builder.push(" AND status = 'active'");
    if let Some(search) = &query.search {
        builder.push(" AND (lower(relative_path) LIKE ");
        builder.push_bind(format!("%{}%", escape_like(&search.to_lowercase())));
        builder.push(" ESCAPE '\\' OR lower(name) LIKE ");
        builder.push_bind(format!("%{}%", escape_like(&search.to_lowercase())));
        builder.push(" ESCAPE '\\')");
    }
}

fn push_matrix_filter(builder: &mut QueryBuilder<Sqlite>, query: &MatrixQuery) {
    builder.push_bind(query.project_id.to_string());
    if let Some(search) = &query.search {
        builder.push(" AND lower(name) LIKE ");
        builder.push_bind(format!("%{}%", escape_like(&search.to_lowercase())));
        builder.push(" ESCAPE '\\'");
    }
}

async fn recalculate_duplicates(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    environment_id: &str,
) -> Result<(), EnvironmentError> {
    sqlx::query(
        "UPDATE environment_key_occurrences SET duplicate = CASE WHEN key_definition_id IN (
            SELECT key_definition_id FROM environment_key_occurrences
            WHERE environment_id = ? GROUP BY key_definition_id HAVING COUNT(*) > 1
         ) THEN 1 ELSE 0 END
         WHERE environment_id = ?",
    )
    .bind(environment_id)
    .bind(environment_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn cleanup_unused_keys(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    project_id: Uuid,
) -> Result<(), EnvironmentError> {
    sqlx::query(
        "DELETE FROM environment_key_definitions
         WHERE project_id = ? AND NOT EXISTS (
            SELECT 1 FROM environment_key_occurrences o
            WHERE o.key_definition_id = environment_key_definitions.id
         )",
    )
    .bind(project_id.to_string())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn validate_exact_ids(existing: &[String], proposed: &[Uuid]) -> Result<(), EnvironmentError> {
    if existing.len() != proposed.len() || proposed.is_empty() && !existing.is_empty() {
        return Err(EnvironmentError::InvalidInput);
    }
    let existing = existing.iter().map(String::as_str).collect::<HashSet<_>>();
    let proposed = proposed.iter().map(Uuid::to_string).collect::<HashSet<_>>();
    if existing.len() != proposed.len() || !existing.iter().all(|id| proposed.contains(*id)) {
        return Err(EnvironmentError::InvalidInput);
    }
    Ok(())
}

fn map_unique_name(
    result: Result<sqlx::sqlite::SqliteQueryResult, sqlx::Error>,
) -> Result<sqlx::sqlite::SqliteQueryResult, EnvironmentError> {
    match result {
        Ok(result) => Ok(result),
        Err(error) if is_unique_violation(&error) => Err(EnvironmentError::DuplicateName),
        Err(error) => Err(error.into()),
    }
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .and_then(|database_error| database_error.code())
        .is_some_and(|code| code == "2067" || code == "1555")
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn parse_uuid(value: &str) -> Result<Uuid, EnvironmentError> {
    Uuid::parse_str(value).map_err(|_| EnvironmentError::InvalidPersistedData)
}

fn to_i64(value: impl TryInto<i64>) -> Result<i64, EnvironmentError> {
    value
        .try_into()
        .map_err(|_| EnvironmentError::InvalidPersistedData)
}

fn from_i64(value: i64) -> Result<u64, EnvironmentError> {
    u64::try_from(value).map_err(|_| EnvironmentError::InvalidPersistedData)
}

fn from_i64_u32(value: i64) -> Result<u32, EnvironmentError> {
    u32::try_from(value).map_err(|_| EnvironmentError::InvalidPersistedData)
}

#[derive(Debug, FromRow)]
struct EnvironmentRow {
    id: String,
    project_id: String,
    name: String,
    description: Option<String>,
    sort_order: i64,
    created_at: String,
    updated_at: String,
}

impl TryFrom<EnvironmentRow> for Environment {
    type Error = EnvironmentError;

    fn try_from(row: EnvironmentRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            name: row.name,
            description: row.description,
            sort_order: from_i64_u32(row.sort_order)?,
            sources: Vec::new(),
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct SourceRow {
    id: String,
    project_id: String,
    environment_id: String,
    relative_path: String,
    priority: i64,
    status: String,
    parse_status: String,
    size_bytes: Option<i64>,
    modified_at_ms: Option<i64>,
    issue_count: i64,
    last_parsed_at: Option<String>,
    created_at: String,
    updated_at: String,
}

impl TryFrom<SourceRow> for EnvironmentSource {
    type Error = EnvironmentError;

    fn try_from(row: SourceRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            environment_id: parse_uuid(&row.environment_id)?,
            relative_path: row.relative_path,
            priority: from_i64_u32(row.priority)?,
            status: SourceStatus::try_from(row.status.as_str())?,
            parse_status: ParseStatus::try_from(row.parse_status.as_str())?,
            size_bytes: row.size_bytes.map(from_i64).transpose()?,
            modified_at_ms: row.modified_at_ms,
            issue_count: from_i64_u32(row.issue_count)?,
            last_parsed_at: row.last_parsed_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct SourceOrderRow {
    environment_id: String,
    priority: i64,
}

#[derive(Debug, FromRow)]
struct SourceCandidateRow {
    id: String,
    relative_path: String,
    name: String,
    status: String,
}

#[derive(Debug, FromRow)]
struct MatrixColumnRow {
    id: String,
    name: String,
    sort_order: i64,
}

impl TryFrom<MatrixColumnRow> for MatrixColumn {
    type Error = EnvironmentError;

    fn try_from(row: MatrixColumnRow) -> Result<Self, Self::Error> {
        Ok(Self {
            environment_id: parse_uuid(&row.id)?,
            name: row.name,
            sort_order: from_i64_u32(row.sort_order)?,
        })
    }
}

#[derive(Debug, FromRow)]
struct KeyDefinitionRow {
    id: String,
    name: String,
}

#[derive(Debug, FromRow)]
struct MatrixOccurrenceRow {
    key_definition_id: String,
    environment_id: String,
    source_id: String,
    relative_path: String,
    line_number: i64,
    priority: i64,
    commented: i64,
    duplicate: i64,
}

#[derive(Debug, FromRow)]
struct SourceHealthRow {
    environment_id: String,
    unavailable: i64,
    has_issue: i64,
}

#[cfg(test)]
mod tests {
    use super::validate_exact_ids;
    use uuid::Uuid;

    #[test]
    fn reorder_validation_rejects_missing_duplicate_and_foreign_ids() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let existing = vec![first.to_string(), second.to_string()];
        assert!(validate_exact_ids(&existing, &[second, first]).is_ok());
        assert!(validate_exact_ids(&existing, &[first]).is_err());
        assert!(validate_exact_ids(&existing, &[first, first]).is_err());
        assert!(validate_exact_ids(&existing, &[first, Uuid::new_v4()]).is_err());
    }
}
