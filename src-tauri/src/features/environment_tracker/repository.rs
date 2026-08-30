use std::collections::{HashMap, HashSet};

use sqlx::{FromRow, QueryBuilder, Sqlite, SqlitePool};
use uuid::Uuid;

use super::error::EnvironmentError;
use super::model::{
    CustomEnvironmentKey, CustomEnvironmentSource, Environment, EnvironmentMatrixCell,
    EnvironmentMatrixCellState, EnvironmentMatrixCellValidation, EnvironmentMatrixPage,
    EnvironmentMatrixQuery, EnvironmentMatrixRow, EnvironmentMatrixRuleKey,
    EnvironmentMatrixSourceDetail, EnvironmentSource, EnvironmentSourceCandidate,
    EnvironmentSourceCandidatePage, EnvironmentSourceCandidateQuery, EnvironmentSourceOrigin,
    EnvironmentSourceParseStatus,
};
use super::parser::{ParsedEnvironmentSource, SafeParseIssue};

#[derive(Debug, Clone)]
pub(crate) struct SqliteEnvironmentRepository {
    pool: SqlitePool,
}

impl SqliteEnvironmentRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub(crate) async fn list_environments(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<Environment>, EnvironmentError> {
        sqlx::query_as::<_, EnvironmentRow>(
            "SELECT id, project_id, name, description, sort_order, created_at, updated_at
             FROM environments WHERE project_id = ? ORDER BY sort_order ASC, lower(name) ASC, id ASC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn create_environment(
        &self,
        project_id: Uuid,
        name: &str,
        normalized_name: &str,
        description: Option<&str>,
    ) -> Result<Environment, EnvironmentError> {
        let id = Uuid::new_v4();
        let mut transaction = self.pool.begin().await?;
        let sort_order: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(sort_order) + 1, 0) FROM environments WHERE project_id = ?",
        )
        .bind(project_id.to_string())
        .fetch_one(&mut *transaction)
        .await?;
        let result = sqlx::query(
            "INSERT INTO environments (id, project_id, name, normalized_name, description, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(project_id.to_string())
        .bind(name)
        .bind(normalized_name)
        .bind(description)
        .bind(sort_order)
        .execute(&mut *transaction)
        .await;
        match result {
            Ok(_) => transaction.commit().await?,
            Err(error) if is_unique_violation(&error) => {
                return Err(EnvironmentError::DuplicateEnvironment)
            }
            Err(error) => return Err(error.into()),
        }
        self.environment(project_id, id).await
    }

    pub(crate) async fn update_environment(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        name: &str,
        normalized_name: &str,
        description: Option<&str>,
    ) -> Result<Environment, EnvironmentError> {
        let result = sqlx::query(
            "UPDATE environments SET name = ?, normalized_name = ?, description = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND project_id = ?",
        )
        .bind(name)
        .bind(normalized_name)
        .bind(description)
        .bind(environment_id.to_string())
        .bind(project_id.to_string())
        .execute(&self.pool)
        .await;
        match result {
            Ok(result) if result.rows_affected() == 0 => {
                return Err(EnvironmentError::EnvironmentNotFound)
            }
            Ok(_) => {}
            Err(error) if is_unique_violation(&error) => {
                return Err(EnvironmentError::DuplicateEnvironment)
            }
            Err(error) => return Err(error.into()),
        }
        self.environment(project_id, environment_id).await
    }

    pub(crate) async fn delete_environment(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        let mut transaction = self.pool.begin().await?;
        let result = sqlx::query("DELETE FROM environments WHERE id = ? AND project_id = ?")
            .bind(environment_id.to_string())
            .bind(project_id.to_string())
            .execute(&mut *transaction)
            .await?;
        if result.rows_affected() == 0 {
            return Err(EnvironmentError::EnvironmentNotFound);
        }
        cleanup_orphaned_definitions(&mut transaction, project_id).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn reorder_environments(
        &self,
        project_id: Uuid,
        environment_ids: &[Uuid],
    ) -> Result<(), EnvironmentError> {
        let existing = self.list_environments(project_id).await?;
        ensure_exact_ids(
            existing.iter().map(|environment| environment.id),
            environment_ids,
        )?;
        let mut transaction = self.pool.begin().await?;
        for (index, environment_id) in environment_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE environments SET sort_order = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ? AND project_id = ?",
            )
            .bind(i64::try_from(index).map_err(|_| EnvironmentError::InvalidInput)?)
            .bind(environment_id.to_string())
            .bind(project_id.to_string())
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn list_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<Vec<EnvironmentSource>, EnvironmentError> {
        sqlx::query_as::<_, EnvironmentSourceRow>(
            "SELECT id, project_id, environment_id, relative_path, sort_order, parse_status,
                    last_observed_size_bytes, last_observed_modified_at_ms, last_parsed_at,
                    last_successful_parse_at, last_issue_line, last_issue_code, last_issue_message,
                    created_at, updated_at
             FROM environment_sources
             WHERE project_id = ? AND environment_id = ?
             ORDER BY sort_order ASC, lower(relative_path) ASC, id ASC",
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
        sqlx::query_as::<_, EnvironmentSourceRow>(
            "SELECT id, project_id, environment_id, relative_path, sort_order, parse_status,
                    last_observed_size_bytes, last_observed_modified_at_ms, last_parsed_at,
                    last_successful_parse_at, last_issue_line, last_issue_code, last_issue_message,
                    created_at, updated_at
             FROM environment_sources WHERE project_id = ?
             ORDER BY environment_id ASC, sort_order ASC, lower(relative_path) ASC, id ASC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn create_source(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        relative_path: &str,
    ) -> Result<EnvironmentSource, EnvironmentError> {
        self.environment(project_id, environment_id).await?;
        let id = Uuid::new_v4();
        let mut transaction = self.pool.begin().await?;
        let sort_order: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(sort_order) + 1, 0) FROM environment_sources
             WHERE project_id = ? AND environment_id = ?",
        )
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .fetch_one(&mut *transaction)
        .await?;
        let result = sqlx::query(
            "INSERT INTO environment_sources (
                id, project_id, environment_id, relative_path, normalized_path, sort_order
             ) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .bind(relative_path)
        .bind(normalize_path(relative_path))
        .bind(sort_order)
        .execute(&mut *transaction)
        .await;
        match result {
            Ok(_) => transaction.commit().await?,
            Err(error) if is_unique_violation(&error) => {
                return Err(EnvironmentError::DuplicateSource)
            }
            Err(error) => return Err(error.into()),
        }
        self.source(project_id, environment_id, id).await
    }

    pub(crate) async fn delete_source(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        source_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        let mut transaction = self.pool.begin().await?;
        let result = sqlx::query(
            "DELETE FROM environment_sources WHERE id = ? AND project_id = ? AND environment_id = ?",
        )
        .bind(source_id.to_string())
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .execute(&mut *transaction)
        .await?;
        if result.rows_affected() == 0 {
            return Err(EnvironmentError::SourceNotFound);
        }
        recompute_duplicates(&mut transaction, environment_id).await?;
        cleanup_orphaned_definitions(&mut transaction, project_id).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn reorder_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        source_ids: &[Uuid],
    ) -> Result<(), EnvironmentError> {
        let existing = self.list_sources(project_id, environment_id).await?;
        ensure_exact_ids(existing.iter().map(|source| source.id), source_ids)?;
        let mut transaction = self.pool.begin().await?;
        for (index, source_id) in source_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE environment_sources SET sort_order = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ? AND project_id = ? AND environment_id = ?",
            )
            .bind(i64::try_from(index).map_err(|_| EnvironmentError::InvalidInput)?)
            .bind(source_id.to_string())
            .bind(project_id.to_string())
            .bind(environment_id.to_string())
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn list_custom_sources(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
    ) -> Result<Vec<CustomEnvironmentSource>, EnvironmentError> {
        let source_rows = sqlx::query_as::<_, CustomSourceRow>(
            "SELECT DISTINCT s.id, l.project_id, l.environment_id, s.name, s.sort_order,
                    s.created_at, s.updated_at
             FROM credential_sources s
             JOIN credentials c ON c.source_id = s.id
             JOIN credential_environment_links l ON l.credential_id = c.id
             WHERE l.project_id = ? AND l.environment_id = ?
             ORDER BY s.sort_order ASC, lower(s.name) ASC, s.id ASC",
        )
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        let key_rows = sqlx::query_as::<_, CustomKeyRow>(
            "SELECT c.id, l.project_id, l.environment_id, c.source_id,
                    c.key_name AS name, c.normalized_key_name AS normalized_name,
                    c.created_at, c.updated_at
             FROM credentials c
             JOIN credential_environment_links l ON l.credential_id = c.id
             WHERE l.project_id = ? AND l.environment_id = ?
             ORDER BY lower(c.key_name) ASC, c.id ASC",
        )
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        assemble_custom_sources(source_rows, key_rows)
    }

    pub(crate) async fn unlink_custom_source(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        source_id: Uuid,
    ) -> Result<(), EnvironmentError> {
        sqlx::query(
            "DELETE FROM credential_environment_links
             WHERE project_id = ? AND environment_id = ?
               AND credential_id IN (
                   SELECT id FROM credentials WHERE source_id = ?
               )",
        )
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .bind(source_id.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub(crate) async fn source_candidates(
        &self,
        query: &EnvironmentSourceCandidateQuery,
    ) -> Result<EnvironmentSourceCandidatePage, EnvironmentError> {
        let mut count =
            QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM indexed_files WHERE project_id = ");
        push_candidate_filters(&mut count, query);
        let total: i64 = count.build_query_scalar().fetch_one(&self.pool).await?;
        let total_items = to_u64(total)?;

        let mut items = QueryBuilder::<Sqlite>::new(
            "SELECT relative_path, name, extension FROM indexed_files WHERE project_id = ",
        );
        push_candidate_filters(&mut items, query);
        items.push(" ORDER BY lower(relative_path) ASC, id ASC LIMIT ");
        items.push_bind(i64::from(query.page_size));
        items.push(" OFFSET ");
        items.push_bind(to_i64(
            u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size),
        )?);
        let items = items
            .build_query_as::<SourceCandidateRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|row| EnvironmentSourceCandidate {
                relative_path: row.relative_path,
                name: row.name,
                extension: row.extension,
            })
            .collect();
        Ok(EnvironmentSourceCandidatePage {
            items,
            total_items,
            page: query.page,
            page_size: query.page_size,
            total_pages: total_items
                .div_ceil(u64::from(query.page_size))
                .try_into()
                .map_err(|_| EnvironmentError::InvalidPersistedData)?,
        })
    }

    pub(crate) async fn persist_parsed_source(
        &self,
        source: &EnvironmentSource,
        size_bytes: u64,
        modified_at_ms: Option<i64>,
        parsed: ParsedEnvironmentSource,
    ) -> Result<(), EnvironmentError> {
        let mut transaction = self.pool.begin().await?;
        sqlx::query("DELETE FROM environment_key_occurrences WHERE source_id = ?")
            .bind(source.id.to_string())
            .execute(&mut *transaction)
            .await?;
        for occurrence in parsed.occurrences {
            let key_id = find_or_create_key_definition(
                &mut transaction,
                source.project_id,
                &occurrence.name,
                &occurrence.normalized_name,
            )
            .await?;
            sqlx::query(
                "INSERT INTO environment_key_occurrences (
                    id, project_id, environment_id, source_id, key_definition_id, line_number,
                    is_commented, is_duplicate, parse_status, observed_name
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'recognized', ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(source.project_id.to_string())
            .bind(source.environment_id.to_string())
            .bind(source.id.to_string())
            .bind(key_id)
            .bind(i64::from(occurrence.line_number))
            .bind(occurrence.is_commented)
            .bind(&occurrence.name)
            .execute(&mut *transaction)
            .await?;
        }
        sqlx::query(
            "UPDATE environment_sources SET parse_status = 'parsed', last_observed_size_bytes = ?,
                last_observed_modified_at_ms = ?, last_parsed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                last_successful_parse_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                last_issue_line = NULL, last_issue_code = NULL, last_issue_message = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        )
        .bind(to_i64(size_bytes)?)
        .bind(modified_at_ms)
        .bind(source.id.to_string())
        .execute(&mut *transaction)
        .await?;
        recompute_duplicates(&mut transaction, source.environment_id).await?;
        cleanup_orphaned_definitions(&mut transaction, source.project_id).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn persist_source_issue(
        &self,
        source: &EnvironmentSource,
        status: EnvironmentSourceParseStatus,
        size_bytes: Option<u64>,
        modified_at_ms: Option<i64>,
        issue: Option<&SafeParseIssue>,
    ) -> Result<(), EnvironmentError> {
        sqlx::query(
            "UPDATE environment_sources SET parse_status = ?, last_observed_size_bytes = ?,
                last_observed_modified_at_ms = ?, last_parsed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                last_issue_line = ?, last_issue_code = ?, last_issue_message = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND project_id = ? AND environment_id = ?",
        )
        .bind(status.as_str())
        .bind(size_bytes.map(to_i64).transpose()?)
        .bind(modified_at_ms)
        .bind(issue.and_then(|issue| issue.line_number.map(i64::from)))
        .bind(issue.map(|issue| issue.code.as_str()))
        .bind(issue.map(|issue| issue.code.safe_message()))
        .bind(source.id.to_string())
        .bind(source.project_id.to_string())
        .bind(source.environment_id.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub(crate) async fn matrix(
        &self,
        query: &EnvironmentMatrixQuery,
        rule_keys: &[EnvironmentMatrixRuleKey],
    ) -> Result<EnvironmentMatrixPage, EnvironmentError> {
        let environments = self.list_environments(query.project_id).await?;
        let rule_keys_json =
            serde_json::to_string(rule_keys).map_err(|_| EnvironmentError::InvalidInput)?;
        let mut count = QueryBuilder::<Sqlite>::new("");
        push_matrix_keys(&mut count, query, &rule_keys_json);
        count.push(" SELECT COUNT(*) FROM matrix_keys WHERE 1 = 1");
        push_matrix_filters(&mut count, query);
        let total_items = to_u64(count.build_query_scalar().fetch_one(&self.pool).await?)?;
        let definitions = self.matrix_definitions(query, &rule_keys_json).await?;
        let sources = self.sources_for_project(query.project_id).await?;
        let sources_by_environment = sources.iter().fold(
            HashMap::<Uuid, Vec<&EnvironmentSource>>::new(),
            |mut groups, source| {
                groups
                    .entry(source.environment_id)
                    .or_default()
                    .push(source);
                groups
            },
        );
        let occurrences = self
            .matrix_occurrences(query.project_id, &definitions)
            .await?;
        let mut occurrences_by_key_environment = HashMap::<(Uuid, Uuid), Vec<OccurrenceRow>>::new();
        for occurrence in occurrences {
            occurrences_by_key_environment
                .entry((
                    occurrence.key_definition_id()?,
                    occurrence.environment_id()?,
                ))
                .or_default()
                .push(occurrence);
        }

        let rows = definitions
            .into_iter()
            .map(
                |definition| -> Result<EnvironmentMatrixRow, EnvironmentError> {
                    let definition_id = definition.id()?;
                    let cells = environments
                        .iter()
                        .map(
                            |environment| -> Result<EnvironmentMatrixCell, EnvironmentError> {
                                let occurrences = definition_id
                                    .and_then(|definition_id| {
                                        occurrences_by_key_environment
                                            .get(&(definition_id, environment.id))
                                    })
                                    .map(Vec::as_slice)
                                    .unwrap_or_default();
                                matrix_cell(
                                    occurrences,
                                    sources_by_environment
                                        .get(&environment.id)
                                        .map(Vec::as_slice)
                                        .unwrap_or_default(),
                                )
                            },
                        )
                        .collect::<Result<Vec<_>, _>>()?;
                    Ok(EnvironmentMatrixRow {
                        key_name: definition.name,
                        cells,
                    })
                },
            )
            .collect::<Result<Vec<_>, _>>()?;

        Ok(EnvironmentMatrixPage {
            environments,
            rows,
            total_items,
            page: query.page,
            page_size: query.page_size,
            total_pages: total_items
                .div_ceil(u64::from(query.page_size))
                .try_into()
                .map_err(|_| EnvironmentError::InvalidPersistedData)?,
        })
    }

    async fn environment(
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
        .ok_or(EnvironmentError::EnvironmentNotFound)?;
        row.try_into()
    }

    async fn source(
        &self,
        project_id: Uuid,
        environment_id: Uuid,
        source_id: Uuid,
    ) -> Result<EnvironmentSource, EnvironmentError> {
        let row = sqlx::query_as::<_, EnvironmentSourceRow>(
            "SELECT id, project_id, environment_id, relative_path, sort_order, parse_status,
                    last_observed_size_bytes, last_observed_modified_at_ms, last_parsed_at,
                    last_successful_parse_at, last_issue_line, last_issue_code, last_issue_message,
                    created_at, updated_at
             FROM environment_sources WHERE id = ? AND project_id = ? AND environment_id = ?",
        )
        .bind(source_id.to_string())
        .bind(project_id.to_string())
        .bind(environment_id.to_string())
        .fetch_optional(&self.pool)
        .await?
        .ok_or(EnvironmentError::SourceNotFound)?;
        row.try_into()
    }

    async fn matrix_definitions(
        &self,
        query: &EnvironmentMatrixQuery,
        rule_keys_json: &str,
    ) -> Result<Vec<KeyDefinitionRow>, EnvironmentError> {
        let mut builder = QueryBuilder::<Sqlite>::new("");
        push_matrix_keys(&mut builder, query, rule_keys_json);
        builder.push(" SELECT id, name FROM matrix_keys WHERE 1 = 1");
        push_matrix_filters(&mut builder, query);
        builder.push(" ORDER BY normalized_name ASC, id ASC LIMIT ");
        builder.push_bind(i64::from(query.page_size));
        builder.push(" OFFSET ");
        builder.push_bind(to_i64(
            u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size),
        )?);
        Ok(builder
            .build_query_as::<KeyDefinitionRow>()
            .fetch_all(&self.pool)
            .await?)
    }

    async fn matrix_occurrences(
        &self,
        project_id: Uuid,
        definitions: &[KeyDefinitionRow],
    ) -> Result<Vec<OccurrenceRow>, EnvironmentError> {
        if definitions.is_empty() {
            return Ok(Vec::new());
        }
        let definition_ids = definitions
            .iter()
            .filter_map(|definition| definition.id.as_deref())
            .collect::<Vec<_>>();
        if definition_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut builder = QueryBuilder::<Sqlite>::new(
            "SELECT o.key_definition_id, o.environment_id, o.source_id,
                    o.line_number, o.is_commented, o.is_duplicate,
                    'file' AS origin, s.relative_path AS source_name,
                    s.relative_path, s.sort_order,
                    NULL AS credential_id
             FROM environment_key_occurrences o
             JOIN environment_sources s
               ON s.project_id = o.project_id AND s.id = o.source_id
             WHERE o.project_id = ",
        );
        builder.push_bind(project_id.to_string());
        builder.push(" AND key_definition_id IN (");
        let mut separated = builder.separated(", ");
        for definition_id in &definition_ids {
            separated.push_bind(definition_id);
        }
        separated.push_unseparated(")");
        builder.push(
            " UNION ALL
             SELECT l.key_definition_id, e.environment_id, c.source_id,
                    NULL AS line_number, 0 AS is_commented, 0 AS is_duplicate,
                    'custom' AS origin, s.name AS source_name,
                    NULL AS relative_path, s.sort_order,
                    c.id AS credential_id
             FROM credential_project_links l
             JOIN credentials c ON c.id = l.credential_id
             JOIN credential_environment_links e
               ON e.credential_id = l.credential_id AND e.project_id = l.project_id
             JOIN credential_sources s ON s.id = c.source_id
             WHERE l.project_id = ",
        );
        builder.push_bind(project_id.to_string());
        builder.push(" AND l.key_definition_id IN (");
        let mut separated = builder.separated(", ");
        for definition_id in &definition_ids {
            separated.push_bind(definition_id);
        }
        separated.push_unseparated(")");
        Ok(builder
            .build_query_as::<OccurrenceRow>()
            .fetch_all(&self.pool)
            .await?)
    }
}

fn matrix_cell(
    occurrences: &[OccurrenceRow],
    environment_sources: &[&EnvironmentSource],
) -> Result<EnvironmentMatrixCell, EnvironmentError> {
    let mut source_details = Vec::new();
    for occurrence in occurrences {
        source_details.push((
            u32::try_from(occurrence.sort_order)
                .map_err(|_| EnvironmentError::InvalidPersistedData)?,
            EnvironmentMatrixSourceDetail {
                source_id: occurrence.source_id()?,
                source_name: occurrence.source_name.clone(),
                origin: EnvironmentSourceOrigin::try_from(occurrence.origin.as_str())
                    .map_err(|_| EnvironmentError::InvalidPersistedData)?,
                relative_path: occurrence.relative_path.clone(),
                line_number: occurrence
                    .line_number
                    .map(u32::try_from)
                    .transpose()
                    .map_err(|_| EnvironmentError::InvalidPersistedData)?,
                is_commented: occurrence.is_commented,
                credential_id: occurrence
                    .credential_id
                    .as_deref()
                    .map(parse_uuid)
                    .transpose()?,
            },
        ));
    }
    source_details.sort_by(|left, right| {
        left.0
            .cmp(&right.0)
            .then(left.1.line_number.cmp(&right.1.line_number))
    });
    let active_count = occurrences
        .iter()
        .filter(|occurrence| !occurrence.is_commented)
        .count();
    let state = if active_count > 1 || occurrences.iter().any(|occurrence| occurrence.is_duplicate)
    {
        EnvironmentMatrixCellState::Duplicate
    } else if occurrences
        .iter()
        .any(|occurrence| !occurrence.is_commented)
    {
        EnvironmentMatrixCellState::Present
    } else if !occurrences.is_empty() {
        EnvironmentMatrixCellState::Commented
    } else if environment_sources.iter().any(|source| {
        matches!(
            source.parse_status,
            EnvironmentSourceParseStatus::ParseIssue
                | EnvironmentSourceParseStatus::UnsupportedEncoding
        )
    }) {
        EnvironmentMatrixCellState::ParseIssue
    } else if environment_sources.iter().any(|source| {
        matches!(
            source.parse_status,
            EnvironmentSourceParseStatus::Missing | EnvironmentSourceParseStatus::Unreadable
        )
    }) {
        EnvironmentMatrixCellState::SourceUnreadable
    } else {
        EnvironmentMatrixCellState::Absent
    };
    Ok(EnvironmentMatrixCell {
        state,
        source_details: source_details
            .into_iter()
            .map(|(_, detail)| detail)
            .collect(),
        validation: EnvironmentMatrixCellValidation::default(),
    })
}

fn push_matrix_keys(
    builder: &mut QueryBuilder<Sqlite>,
    query: &EnvironmentMatrixQuery,
    rule_keys_json: &str,
) {
    builder.push(
        "WITH matrix_keys AS (
           SELECT d.id, d.name, d.normalized_name
           FROM environment_key_definitions d
           WHERE d.project_id = ",
    );
    builder.push_bind(query.project_id.to_string());
    if let Some(environment_id) = query.environment_id {
        builder.push(
            " AND (EXISTS (
                SELECT 1 FROM environment_key_occurrences o
                WHERE o.project_id = d.project_id
                  AND o.key_definition_id = d.id
                  AND o.environment_id = ",
        );
        builder.push_bind(environment_id.to_string());
        builder.push(
            ") OR EXISTS (
                SELECT 1 FROM credential_project_links l
                JOIN credential_environment_links e
                  ON e.credential_id = l.credential_id AND e.project_id = l.project_id
                WHERE l.project_id = d.project_id
                  AND l.key_definition_id = d.id
                  AND e.environment_id = ",
        );
        builder.push_bind(environment_id.to_string());
        builder.push("))");
    } else {
        builder.push(
            " AND (EXISTS (
                SELECT 1 FROM environment_key_occurrences o
                WHERE o.project_id = d.project_id
                  AND o.key_definition_id = d.id
            ) OR EXISTS (
                SELECT 1 FROM credential_project_links l
                JOIN credential_environment_links e
                  ON e.credential_id = l.credential_id AND e.project_id = l.project_id
                WHERE l.project_id = d.project_id
                  AND l.key_definition_id = d.id
            ))",
        );
    }
    builder.push(
        " UNION ALL
          SELECT NULL AS id,
                 json_extract(rule.value, '$.name') AS name,
                 json_extract(rule.value, '$.normalizedName') AS normalized_name
          FROM json_each(",
    );
    builder.push_bind(rule_keys_json.to_owned());
    builder.push(
        ") AS rule WHERE NOT EXISTS (
        SELECT 1 FROM environment_key_definitions d
        WHERE d.project_id = ",
    );
    builder.push_bind(query.project_id.to_string());
    builder.push(" AND d.normalized_name = json_extract(rule.value, '$.normalizedName')");
    if let Some(environment_id) = query.environment_id {
        builder.push(
            " AND (EXISTS (
                SELECT 1 FROM environment_key_occurrences o
                WHERE o.project_id = d.project_id
                  AND o.key_definition_id = d.id
                  AND o.environment_id = ",
        );
        builder.push_bind(environment_id.to_string());
        builder.push(
            ") OR EXISTS (
                SELECT 1 FROM credential_project_links l
                JOIN credential_environment_links e
                  ON e.credential_id = l.credential_id AND e.project_id = l.project_id
                WHERE l.project_id = d.project_id
                  AND l.key_definition_id = d.id
                  AND e.environment_id = ",
        );
        builder.push_bind(environment_id.to_string());
        builder.push("))");
    }
    builder.push("))");
}

async fn find_or_create_key_definition(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    project_id: Uuid,
    name: &str,
    normalized_name: &str,
) -> Result<String, EnvironmentError> {
    sqlx::query(
        "INSERT INTO environment_key_definitions (id, project_id, name, normalized_name)
         VALUES (?, ?, ?, ?) ON CONFLICT(project_id, normalized_name) DO NOTHING",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(project_id.to_string())
    .bind(name)
    .bind(normalized_name)
    .execute(&mut **transaction)
    .await?;
    sqlx::query_scalar(
        "SELECT id FROM environment_key_definitions WHERE project_id = ? AND normalized_name = ?",
    )
    .bind(project_id.to_string())
    .bind(normalized_name)
    .fetch_one(&mut **transaction)
    .await
    .map_err(Into::into)
}

async fn recompute_duplicates(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    environment_id: Uuid,
) -> Result<(), EnvironmentError> {
    sqlx::query(
        "UPDATE environment_key_occurrences AS occurrence SET is_duplicate = CASE
            WHEN occurrence.is_commented = 0 THEN EXISTS (
                SELECT 1 FROM environment_key_occurrences AS sibling
                WHERE sibling.environment_id = occurrence.environment_id
                  AND sibling.key_definition_id = occurrence.key_definition_id
                  AND sibling.is_commented = 0 AND sibling.id <> occurrence.id
            )
            ELSE 0
         END WHERE occurrence.environment_id = ?",
    )
    .bind(environment_id.to_string())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn cleanup_orphaned_definitions(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    project_id: Uuid,
) -> Result<(), EnvironmentError> {
    sqlx::query(
        "DELETE FROM environment_key_definitions WHERE project_id = ?
         AND NOT EXISTS (
            SELECT 1 FROM environment_key_occurrences
            WHERE environment_key_occurrences.key_definition_id = environment_key_definitions.id
         ) AND NOT EXISTS (
            SELECT 1 FROM credential_project_links
            WHERE credential_project_links.key_definition_id = environment_key_definitions.id
         )",
    )
    .bind(project_id.to_string())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn push_candidate_filters(
    builder: &mut QueryBuilder<Sqlite>,
    query: &EnvironmentSourceCandidateQuery,
) {
    builder.push_bind(query.project_id.to_string());
    builder.push(" AND status = 'active'");
    if let Some(search) = &query.search {
        let pattern = format!("%{}%", escape_like(search));
        builder.push(" AND (lower(name) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") ESCAPE '\\' OR lower(relative_path) LIKE lower(");
        builder.push_bind(pattern);
        builder.push(") ESCAPE '\\')");
    }
}

fn push_matrix_filters(builder: &mut QueryBuilder<Sqlite>, query: &EnvironmentMatrixQuery) {
    if let Some(search) = &query.search {
        builder.push(" AND lower(name) LIKE lower(");
        builder.push_bind(format!("%{}%", escape_like(search)));
        builder.push(") ESCAPE '\\'");
    }
}

fn ensure_exact_ids(
    existing: impl Iterator<Item = Uuid>,
    submitted: &[Uuid],
) -> Result<(), EnvironmentError> {
    let existing = existing.collect::<HashSet<_>>();
    let submitted = submitted.iter().copied().collect::<HashSet<_>>();
    if existing.is_empty() || existing.len() != submitted.len() || existing != submitted {
        return Err(EnvironmentError::InvalidInput);
    }
    Ok(())
}

fn normalize_path(value: &str) -> String {
    #[cfg(windows)]
    {
        value.to_ascii_lowercase()
    }
    #[cfg(not(windows))]
    {
        value.to_owned()
    }
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database) if database.is_unique_violation())
}

fn parse_uuid(value: &str) -> Result<Uuid, EnvironmentError> {
    Uuid::parse_str(value).map_err(|_| EnvironmentError::InvalidPersistedData)
}

fn to_i64(value: u64) -> Result<i64, EnvironmentError> {
    i64::try_from(value).map_err(|_| EnvironmentError::InvalidPersistedData)
}

fn to_u64(value: i64) -> Result<u64, EnvironmentError> {
    u64::try_from(value).map_err(|_| EnvironmentError::InvalidPersistedData)
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
            sort_order: u32::try_from(row.sort_order)
                .map_err(|_| EnvironmentError::InvalidPersistedData)?,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct EnvironmentSourceRow {
    id: String,
    project_id: String,
    environment_id: String,
    relative_path: String,
    sort_order: i64,
    parse_status: String,
    last_observed_size_bytes: Option<i64>,
    last_observed_modified_at_ms: Option<i64>,
    last_parsed_at: Option<String>,
    last_successful_parse_at: Option<String>,
    last_issue_line: Option<i64>,
    last_issue_code: Option<String>,
    last_issue_message: Option<String>,
    created_at: String,
    updated_at: String,
}

impl TryFrom<EnvironmentSourceRow> for EnvironmentSource {
    type Error = EnvironmentError;

    fn try_from(row: EnvironmentSourceRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            environment_id: parse_uuid(&row.environment_id)?,
            relative_path: row.relative_path,
            sort_order: u32::try_from(row.sort_order)
                .map_err(|_| EnvironmentError::InvalidPersistedData)?,
            parse_status: EnvironmentSourceParseStatus::try_from(row.parse_status.as_str())
                .map_err(|_| EnvironmentError::InvalidPersistedData)?,
            last_observed_size_bytes: row.last_observed_size_bytes.map(to_u64).transpose()?,
            last_observed_modified_at_ms: row.last_observed_modified_at_ms,
            last_parsed_at: row.last_parsed_at,
            last_successful_parse_at: row.last_successful_parse_at,
            last_issue_line: row
                .last_issue_line
                .map(u32::try_from)
                .transpose()
                .map_err(|_| EnvironmentError::InvalidPersistedData)?,
            last_issue_code: row.last_issue_code,
            last_issue_message: row.last_issue_message,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct SourceCandidateRow {
    relative_path: String,
    name: String,
    extension: Option<String>,
}

#[derive(Debug, FromRow)]
struct KeyDefinitionRow {
    id: Option<String>,
    name: String,
}

impl KeyDefinitionRow {
    fn id(&self) -> Result<Option<Uuid>, EnvironmentError> {
        self.id.as_deref().map(parse_uuid).transpose()
    }
}

#[derive(Debug, FromRow, Clone)]
struct OccurrenceRow {
    key_definition_id: String,
    environment_id: String,
    source_id: String,
    line_number: Option<i64>,
    is_commented: bool,
    is_duplicate: bool,
    origin: String,
    source_name: String,
    relative_path: Option<String>,
    sort_order: i64,
    credential_id: Option<String>,
}

impl TryFrom<&str> for EnvironmentSourceOrigin {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "file" => Ok(Self::File),
            "custom" => Ok(Self::Custom),
            _ => Err(()),
        }
    }
}

#[derive(Debug, FromRow)]
struct CustomSourceRow {
    id: String,
    project_id: String,
    environment_id: String,
    name: String,
    sort_order: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, FromRow)]
struct CustomKeyRow {
    id: String,
    project_id: String,
    environment_id: String,
    source_id: String,
    name: String,
    normalized_name: String,
    created_at: String,
    updated_at: String,
}

impl TryFrom<CustomKeyRow> for CustomEnvironmentKey {
    type Error = EnvironmentError;

    fn try_from(row: CustomKeyRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            environment_id: parse_uuid(&row.environment_id)?,
            source_id: parse_uuid(&row.source_id)?,
            name: row.name,
            normalized_name: row.normalized_name,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

fn assemble_custom_sources(
    rows: Vec<CustomSourceRow>,
    key_rows: Vec<CustomKeyRow>,
) -> Result<Vec<CustomEnvironmentSource>, EnvironmentError> {
    let mut keys_by_source = key_rows.into_iter().try_fold(
        HashMap::<Uuid, Vec<CustomEnvironmentKey>>::new(),
        |mut groups, row| -> Result<_, EnvironmentError> {
            let source_id = parse_uuid(&row.source_id)?;
            groups.entry(source_id).or_default().push(row.try_into()?);
            Ok(groups)
        },
    )?;
    rows.into_iter()
        .map(|row| {
            let id = parse_uuid(&row.id)?;
            Ok(CustomEnvironmentSource {
                id,
                project_id: parse_uuid(&row.project_id)?,
                environment_id: parse_uuid(&row.environment_id)?,
                name: row.name,
                sort_order: u32::try_from(row.sort_order)
                    .map_err(|_| EnvironmentError::InvalidPersistedData)?,
                keys: keys_by_source.remove(&id).unwrap_or_default(),
                created_at: row.created_at,
                updated_at: row.updated_at,
            })
        })
        .collect()
}

impl OccurrenceRow {
    fn key_definition_id(&self) -> Result<Uuid, EnvironmentError> {
        parse_uuid(&self.key_definition_id)
    }

    fn environment_id(&self) -> Result<Uuid, EnvironmentError> {
        parse_uuid(&self.environment_id)
    }

    fn source_id(&self) -> Result<Uuid, EnvironmentError> {
        parse_uuid(&self.source_id)
    }
}
