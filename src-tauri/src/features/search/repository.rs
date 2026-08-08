use sqlx::{QueryBuilder, Sqlite, SqlitePool};
use uuid::Uuid;

use crate::features::file_inventory::{FileCategory, FileStatus};

use super::error::SearchError;
use super::model::{
    SearchHistoryRow, SearchMetadataPage, SearchOrigin, SearchQuery, SearchResult, SearchResultRow,
    SearchSortDirection, SearchSortField,
};

const RESULT_COLUMNS: &str = "result_type, id, project_id, project_name, name,
    relative_path, extension, category, status, origin, modified_at_ms, tags, note,
    environment_id, environment_name";

#[derive(Debug, Clone)]
pub(crate) struct SqliteSearchRepository {
    pool: SqlitePool,
}

impl SqliteSearchRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub(super) async fn search(
        &self,
        query: &SearchQuery,
    ) -> Result<SearchMetadataPage, SearchError> {
        let mut transaction = self.pool.begin().await?;
        if let Some(project_id) = query.project_id {
            let exists: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects WHERE id = ?)")
                    .bind(project_id.to_string())
                    .fetch_one(&mut *transaction)
                    .await?;
            if !exists {
                return Err(SearchError::InvalidInput);
            }
        }
        if !query.environment_ids.is_empty() {
            let mut scope =
                QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM environments WHERE id IN (");
            let mut separated = scope.separated(", ");
            for environment_id in &query.environment_ids {
                separated.push_bind(environment_id.to_string());
            }
            separated.push_unseparated(")");
            if let Some(project_id) = query.project_id {
                scope.push(" AND project_id = ");
                scope.push_bind(project_id.to_string());
            }
            let count: i64 = scope
                .build_query_scalar()
                .fetch_one(&mut *transaction)
                .await?;
            if usize::try_from(count).ok() != Some(query.environment_ids.len()) {
                return Err(SearchError::InvalidInput);
            }
        }
        let mut count = candidates_query(query);
        count.push(" SELECT COUNT(*) FROM candidates");
        let total: i64 = count
            .build_query_scalar()
            .fetch_one(&mut *transaction)
            .await?;
        let total_items = to_u64(total)?;

        let mut items = candidates_query(query);
        items.push(" SELECT ");
        items.push(RESULT_COLUMNS);
        items.push(" FROM candidates");
        push_order(&mut items, query);
        items.push(" LIMIT ");
        items.push_bind(i64::from(query.request.page_size));
        items.push(" OFFSET ");
        items.push_bind(to_i64(
            u64::from(query.request.page.saturating_sub(1)) * u64::from(query.request.page_size),
        )?);
        let rows = items
            .build_query_as::<SearchResultRow>()
            .fetch_all(&mut *transaction)
            .await?;
        let items = rows
            .into_iter()
            .map(parse_result)
            .collect::<Result<Vec<_>, _>>()?;
        let total_pages = total_items.div_ceil(u64::from(query.request.page_size));
        transaction.commit().await?;

        Ok(SearchMetadataPage {
            items,
            total_items,
            page: query.request.page,
            page_size: query.request.page_size,
            total_pages: u32::try_from(total_pages)
                .map_err(|_| SearchError::InvalidPersistedData)?,
            has_more: u64::from(query.request.page) < total_pages,
        })
    }

    pub(super) async fn record_history(
        &self,
        id: Uuid,
        project_id: Option<Uuid>,
        query_text: &str,
        request_json: &str,
    ) -> Result<SearchHistoryRow, SearchError> {
        let mut transaction = self.pool.begin().await?;
        sqlx::query("DELETE FROM search_history WHERE request_json = ?")
            .bind(request_json)
            .execute(&mut *transaction)
            .await?;
        sqlx::query(
            "INSERT INTO search_history (id, project_id, query_text, request_json)
             VALUES (?, ?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(project_id.map(|value| value.to_string()))
        .bind(query_text)
        .bind(request_json)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "DELETE FROM search_history WHERE id IN (
                SELECT id FROM search_history
                ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET 20
             )",
        )
        .execute(&mut *transaction)
        .await?;
        let row = sqlx::query_as::<_, SearchHistoryRow>(
            "SELECT id, request_json, created_at FROM search_history WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_one(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(row)
    }

    pub(super) async fn history(&self) -> Result<Vec<SearchHistoryRow>, SearchError> {
        Ok(sqlx::query_as::<_, SearchHistoryRow>(
            "SELECT id, request_json, created_at FROM search_history
             ORDER BY created_at DESC, rowid DESC LIMIT 20",
        )
        .fetch_all(&self.pool)
        .await?)
    }

    pub(super) async fn delete_history(&self, id: Uuid) -> Result<bool, SearchError> {
        let result = sqlx::query("DELETE FROM search_history WHERE id = ?")
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() == 1)
    }

    pub(super) async fn clear_history(&self) -> Result<(), SearchError> {
        sqlx::query("DELETE FROM search_history")
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

fn candidates_query(query: &SearchQuery) -> QueryBuilder<Sqlite> {
    let mut builder = QueryBuilder::<Sqlite>::new("WITH params AS (SELECT lower(");
    builder.push_bind(query.request.query.clone());
    builder.push(") AS needle), candidates AS (");

    let include_files = query.environment_ids.is_empty();
    let include_projects = !query.has_file_filters() && query.environment_ids.is_empty();
    let include_environment_keys = !query.has_file_filters();
    let mut has_branch = false;

    if include_projects {
        push_project_candidates(&mut builder, query);
        has_branch = true;
    }
    if include_files {
        if has_branch {
            builder.push(" UNION ALL ");
        }
        push_file_candidates(&mut builder, query);
        has_branch = true;
    }
    if include_environment_keys {
        if has_branch {
            builder.push(" UNION ALL ");
        }
        push_environment_candidates(&mut builder, query);
        has_branch = true;
    }
    if !has_branch {
        builder.push(
            "SELECT 'file' AS result_type, '' AS id, '' AS project_id,
                    '' AS project_name, '' AS name, NULL AS relative_path,
                    NULL AS extension, NULL AS category, NULL AS status, NULL AS origin,
                    NULL AS modified_at_ms, NULL AS tags, NULL AS note,
                    NULL AS environment_id, NULL AS environment_name, 0 AS relevance
             WHERE 0",
        );
    }
    builder.push(")");
    builder
}

fn push_project_candidates(builder: &mut QueryBuilder<Sqlite>, query: &SearchQuery) {
    builder.push(
        "SELECT 'project' AS result_type, p.id, p.id AS project_id, p.name AS project_name,
                p.name, NULL AS relative_path, NULL AS extension, NULL AS category,
                NULL AS status, NULL AS origin, NULL AS modified_at_ms, NULL AS tags,
                NULL AS note, NULL AS environment_id, NULL AS environment_name,
                CASE WHEN lower(p.name) = params.needle THEN 0
                     WHEN instr(lower(p.name), params.needle) = 1 THEN 1 ELSE 2 END AS relevance
         FROM projects p CROSS JOIN params WHERE
            (length(params.needle) = 0 OR instr(lower(p.name), params.needle) > 0)",
    );
    push_project_filter(builder, query, "p.id");
}

fn push_file_candidates(builder: &mut QueryBuilder<Sqlite>, query: &SearchQuery) {
    builder.push(
        "SELECT 'file' AS result_type, f.id, f.project_id, p.name AS project_name, f.name,
                f.relative_path, f.extension, f.category, f.status,
                CASE WHEN f.managed = 1 THEN 'managed' ELSE 'discovered' END AS origin,
                f.modified_at_ms,
                COALESCE((SELECT group_concat(ordered.name, char(31)) FROM (
                    SELECT t.name FROM file_tags ft JOIN asset_tags t ON t.id = ft.tag_id
                    WHERE ft.indexed_file_id = f.id ORDER BY t.normalized_name, t.id
                ) ordered), '') AS tags,
                (SELECT n.content FROM file_notes n WHERE n.indexed_file_id = f.id) AS note,
                NULL AS environment_id, NULL AS environment_name,
                CASE WHEN lower(f.name) = params.needle THEN 0
                     WHEN instr(lower(f.name), params.needle) = 1 THEN 1
                     WHEN instr(lower(f.relative_path), params.needle) > 0 THEN 2 ELSE 3 END AS relevance
         FROM indexed_files f JOIN projects p ON p.id = f.project_id CROSS JOIN params
         WHERE (length(params.needle) = 0
                OR instr(lower(f.name), params.needle) > 0
                OR instr(lower(f.relative_path), params.needle) > 0
                OR instr(lower(COALESCE(f.extension, '')), params.needle) > 0
                OR instr(lower(f.category), params.needle) > 0
                OR EXISTS (
                    SELECT 1 FROM file_tags search_ft
                    JOIN asset_tags search_tag ON search_tag.id = search_ft.tag_id
                    WHERE search_ft.indexed_file_id = f.id
                      AND instr(lower(search_tag.name), params.needle) > 0
                )
                OR EXISTS (
                    SELECT 1 FROM file_notes search_note
                    WHERE search_note.indexed_file_id = f.id
                      AND instr(lower(search_note.content), params.needle) > 0
                ))",
    );
    push_project_filter(builder, query, "f.project_id");
    push_in_values(
        builder,
        "f.category",
        query
            .request
            .categories
            .iter()
            .map(|value| value.as_str().to_owned()),
    );
    push_in_values(
        builder,
        "lower(COALESCE(f.extension, ''))",
        query.request.extensions.iter().cloned(),
    );
    push_in_values(
        builder,
        "f.status",
        query
            .request
            .statuses
            .iter()
            .map(|value| value.as_str().to_owned()),
    );
    if !query.request.origins.is_empty() {
        let managed = query
            .request
            .origins
            .iter()
            .any(|origin| origin.is_managed());
        let discovered = query
            .request
            .origins
            .iter()
            .any(|origin| !origin.is_managed());
        if managed != discovered {
            builder.push(" AND f.managed = ");
            builder.push_bind(managed);
        }
    }
    if let Some(from) = query.request.modified_from_ms {
        builder.push(" AND f.modified_at_ms >= ");
        builder.push_bind(from);
    }
    if let Some(to) = query.request.modified_to_ms {
        builder.push(" AND f.modified_at_ms <= ");
        builder.push_bind(to);
    }
    if !query.request.tags.is_empty() {
        builder.push(
            " AND (SELECT COUNT(DISTINCT filter_tag.normalized_name)
                   FROM file_tags filter_ft
                   JOIN asset_tags filter_tag ON filter_tag.id = filter_ft.tag_id
                   WHERE filter_ft.indexed_file_id = f.id
                     AND filter_tag.normalized_name IN (",
        );
        let mut separated = builder.separated(", ");
        for tag in &query.request.tags {
            separated.push_bind(tag.clone());
        }
        separated.push_unseparated(")) = ");
        builder.push_bind(i64::try_from(query.request.tags.len()).unwrap_or(i64::MAX));
    }
}

fn push_environment_candidates(builder: &mut QueryBuilder<Sqlite>, query: &SearchQuery) {
    builder.push(
        "SELECT 'environment_key' AS result_type, d.id, d.project_id,
                p.name AS project_name, d.name, NULL AS relative_path, NULL AS extension,
                NULL AS category, NULL AS status, NULL AS origin, NULL AS modified_at_ms,
                NULL AS tags, NULL AS note, e.id AS environment_id, e.name AS environment_name,
                CASE WHEN lower(d.name) = params.needle THEN 0
                     WHEN instr(lower(d.name), params.needle) = 1 THEN 1 ELSE 2 END AS relevance
         FROM environment_key_definitions d
         JOIN environments e
           ON e.project_id = d.project_id
         JOIN projects p ON p.id = d.project_id
         CROSS JOIN params
         WHERE (length(params.needle) = 0 OR instr(lower(d.name), params.needle) > 0)",
    );
    push_project_filter(builder, query, "d.project_id");
    if !query.environment_ids.is_empty() {
        builder.push(" AND e.id IN (");
        let mut separated = builder.separated(", ");
        for id in &query.environment_ids {
            separated.push_bind(id.to_string());
        }
        separated.push_unseparated(")");
    }
    builder.push(" GROUP BY d.id, d.project_id, p.name, d.name, e.id, e.name");
}

fn push_project_filter(builder: &mut QueryBuilder<Sqlite>, query: &SearchQuery, column: &str) {
    if let Some(project_id) = query.project_id {
        builder.push(" AND ");
        builder.push(column);
        builder.push(" = ");
        builder.push_bind(project_id.to_string());
    }
}

fn push_in_values(
    builder: &mut QueryBuilder<Sqlite>,
    column: &str,
    values: impl Iterator<Item = String>,
) {
    let values = values.collect::<Vec<_>>();
    if values.is_empty() {
        return;
    }
    builder.push(" AND ");
    builder.push(column);
    builder.push(" IN (");
    let mut separated = builder.separated(", ");
    for value in values {
        separated.push_bind(value);
    }
    separated.push_unseparated(")");
}

fn push_order(builder: &mut QueryBuilder<Sqlite>, query: &SearchQuery) {
    builder.push(" ORDER BY ");
    match query.request.sort_by {
        SearchSortField::Relevance => builder.push("relevance"),
        SearchSortField::Name => builder.push("lower(name)"),
        SearchSortField::Project => builder.push("lower(project_name)"),
        SearchSortField::Modified => builder.push("COALESCE(modified_at_ms, -1)"),
    };
    match query.request.sort_direction {
        SearchSortDirection::Ascending => builder.push(" ASC"),
        SearchSortDirection::Descending => builder.push(" DESC"),
    };
    builder.push(
        ", lower(name) ASC, result_type ASC, lower(COALESCE(environment_name, '')) ASC, id ASC",
    );
}

fn parse_result(row: SearchResultRow) -> Result<SearchResult, SearchError> {
    let id = parse_uuid(&row.id)?;
    let project_id = parse_uuid(&row.project_id)?;
    match row.result_type.as_str() {
        "project" => Ok(SearchResult::Project {
            id,
            project_id,
            project_name: row.project_name,
            name: row.name,
        }),
        "file" => Ok(SearchResult::File {
            id,
            project_id,
            project_name: row.project_name,
            name: row.name,
            relative_path: row.relative_path.ok_or(SearchError::InvalidPersistedData)?,
            extension: row.extension,
            category: FileCategory::try_from(
                row.category
                    .as_deref()
                    .ok_or(SearchError::InvalidPersistedData)?,
            )
            .map_err(|_| SearchError::InvalidPersistedData)?,
            status: FileStatus::try_from(
                row.status
                    .as_deref()
                    .ok_or(SearchError::InvalidPersistedData)?,
            )
            .map_err(|_| SearchError::InvalidPersistedData)?,
            origin: match row.origin.as_deref() {
                Some("managed") => SearchOrigin::Managed,
                Some("discovered") => SearchOrigin::Discovered,
                _ => return Err(SearchError::InvalidPersistedData),
            },
            modified_at_ms: row.modified_at_ms,
            tags: row
                .tags
                .as_deref()
                .unwrap_or_default()
                .split(char::from(31))
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
                .collect(),
            note: row.note,
        }),
        "environment_key" => Ok(SearchResult::EnvironmentKey {
            id,
            project_id,
            project_name: row.project_name,
            name: row.name,
            environment_id: parse_uuid(
                row.environment_id
                    .as_deref()
                    .ok_or(SearchError::InvalidPersistedData)?,
            )?,
            environment_name: row
                .environment_name
                .ok_or(SearchError::InvalidPersistedData)?,
        }),
        _ => Err(SearchError::InvalidPersistedData),
    }
}

fn parse_uuid(value: &str) -> Result<Uuid, SearchError> {
    Uuid::parse_str(value).map_err(|_| SearchError::InvalidPersistedData)
}

fn to_u64(value: i64) -> Result<u64, SearchError> {
    value
        .try_into()
        .map_err(|_| SearchError::InvalidPersistedData)
}

fn to_i64(value: u64) -> Result<i64, SearchError> {
    value.try_into().map_err(|_| SearchError::InvalidInput)
}
