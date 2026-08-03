use std::collections::HashSet;
#[cfg(test)]
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use sqlx::{FromRow, QueryBuilder, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::features::file_inventory::FileCategory;

use super::error::AssetError;
use super::model::{
    Asset, AssetMetadataUpdate, AssetOrigin, AssetPage, AssetQuery, AssetSortField,
    AssetVariantsUpdate, HashCandidate, ImportedFileRecord, SortDirection, VariantCandidateQuery,
    VariantCandidateRecord, VariantCandidateRecordsPage, VariantCandidateScope,
};

const LIST_SELECT: &str = "SELECT
    f.id, f.project_id, f.relative_path, f.name, f.extension, f.mime_type,
    f.size_bytes, f.modified_at_ms, f.category, f.status, f.managed,
    f.is_favorite, f.updated_at, n.content AS note,
    COALESCE((SELECT group_concat(ordered_tags.name, char(31)) FROM (
      SELECT t.name FROM file_tags ft JOIN asset_tags t ON t.id = ft.tag_id
      WHERE ft.indexed_file_id = f.id ORDER BY t.normalized_name
    ) ordered_tags), '') AS tags,
    COALESCE((SELECT group_concat(
        CASE WHEN r.primary_file_id = f.id THEN r.variant_file_id ELSE r.primary_file_id END,
        char(31)) FROM asset_relations r
      WHERE r.project_id = f.project_id
        AND (r.primary_file_id = f.id OR r.variant_file_id = f.id)), '') AS variant_ids
    FROM indexed_files f LEFT JOIN file_notes n ON n.indexed_file_id = f.id WHERE f.project_id = ";

const VARIANT_SELECT: &str = "SELECT
    f.id, f.relative_path, f.name, f.extension, f.category, f.managed, f.status,
    COALESCE((SELECT group_concat(ordered_tags.name, char(31)) FROM (
      SELECT t.name FROM file_tags ft JOIN asset_tags t ON t.id = ft.tag_id
      WHERE ft.indexed_file_id = f.id ORDER BY t.normalized_name
    ) ordered_tags), '') AS tags
    FROM indexed_files f WHERE f.project_id = ";

#[allow(async_fn_in_trait)]
pub(super) trait AssetRepository: Send + Sync {
    async fn query(&self, query: &AssetQuery) -> Result<AssetPage, AssetError>;
    async fn find(&self, project_id: Uuid, asset_id: Uuid) -> Result<Option<Asset>, AssetError>;
    async fn same_size_candidates(
        &self,
        project_id: Uuid,
        size_bytes: u64,
    ) -> Result<Vec<HashCandidate>, AssetError>;
    async fn cache_hash(
        &self,
        asset_id: Uuid,
        hash: &str,
        size_bytes: u64,
        modified_at_ms: Option<i64>,
    ) -> Result<(), AssetError>;
    async fn persist_import(&self, record: ImportedFileRecord) -> Result<Asset, AssetError>;
    async fn update_metadata(&self, update: AssetMetadataUpdate) -> Result<Asset, AssetError>;
    async fn variant_candidates(
        &self,
        query: &VariantCandidateQuery,
        current: &Asset,
        asset_root: &str,
        current_folder: &str,
    ) -> Result<VariantCandidateRecordsPage, AssetError>;
    async fn variant_by_relative_path(
        &self,
        project_id: Uuid,
        relative_path: &str,
    ) -> Result<Option<VariantCandidateRecord>, AssetError>;
    async fn variants_for_asset(
        &self,
        project_id: Uuid,
        asset_id: Uuid,
    ) -> Result<Vec<VariantCandidateRecord>, AssetError>;
    async fn variant_records_by_ids(
        &self,
        project_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<VariantCandidateRecord>, AssetError>;
    async fn relation_edges_excluding(
        &self,
        project_id: Uuid,
        asset_id: Uuid,
    ) -> Result<Vec<(Uuid, Uuid)>, AssetError>;
    async fn update_variants(&self, update: AssetVariantsUpdate) -> Result<Asset, AssetError>;
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteAssetRepository {
    pool: SqlitePool,
    #[cfg(test)]
    fail_persist: Arc<AtomicBool>,
}

impl SqliteAssetRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            #[cfg(test)]
            fail_persist: Arc::new(AtomicBool::new(false)),
        }
    }

    #[cfg(test)]
    pub(super) fn fail_next_persist(&self) {
        self.fail_persist.store(true, Ordering::SeqCst);
    }

    async fn one(&self, project_id: Uuid, asset_id: Uuid) -> Result<Option<Asset>, AssetError> {
        let mut builder = QueryBuilder::<Sqlite>::new(LIST_SELECT);
        builder.push_bind(project_id.to_string());
        builder.push(" AND f.id = ");
        builder.push_bind(asset_id.to_string());
        builder
            .build_query_as::<AssetRow>()
            .fetch_optional(&self.pool)
            .await?
            .map(TryInto::try_into)
            .transpose()
    }
}

impl AssetRepository for SqliteAssetRepository {
    async fn query(&self, query: &AssetQuery) -> Result<AssetPage, AssetError> {
        let mut count = QueryBuilder::<Sqlite>::new(
            "SELECT COUNT(*) FROM indexed_files f WHERE f.project_id = ",
        );
        push_filters(&mut count, query);
        let total = from_i64(
            count
                .build_query_scalar::<i64>()
                .fetch_one(&self.pool)
                .await?,
        )?;

        let mut items = QueryBuilder::<Sqlite>::new(LIST_SELECT);
        push_filters(&mut items, query);
        push_order(&mut items, query);
        items.push(" LIMIT ").push_bind(i64::from(query.page_size));
        let offset = u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size);
        items.push(" OFFSET ").push_bind(to_i64(offset)?);
        let items = items
            .build_query_as::<AssetRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(TryInto::try_into)
            .collect::<Result<Vec<_>, AssetError>>()?;
        let total_pages = u32::try_from(total.div_ceil(u64::from(query.page_size)))
            .map_err(|_| AssetError::InvalidPersistedData)?;
        Ok(AssetPage {
            items,
            total_items: total,
            page: query.page,
            page_size: query.page_size,
            total_pages,
        })
    }

    async fn find(&self, project_id: Uuid, asset_id: Uuid) -> Result<Option<Asset>, AssetError> {
        self.one(project_id, asset_id).await
    }

    async fn same_size_candidates(
        &self,
        project_id: Uuid,
        size_bytes: u64,
    ) -> Result<Vec<HashCandidate>, AssetError> {
        let rows = sqlx::query_as::<_, HashCandidateRow>(
            "SELECT id, relative_path, content_hash, hashed_size_bytes, hashed_modified_at_ms
             FROM indexed_files
             WHERE project_id = ? AND size_bytes = ? AND status = 'active'
             ORDER BY relative_path",
        )
        .bind(project_id.to_string())
        .bind(to_i64(size_bytes)?)
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter().map(TryInto::try_into).collect()
    }

    async fn cache_hash(
        &self,
        asset_id: Uuid,
        hash: &str,
        size_bytes: u64,
        modified_at_ms: Option<i64>,
    ) -> Result<(), AssetError> {
        sqlx::query(
            "UPDATE indexed_files SET content_hash = ?, hashed_size_bytes = ?,
             hashed_modified_at_ms = ? WHERE id = ?",
        )
        .bind(hash)
        .bind(to_i64(size_bytes)?)
        .bind(modified_at_ms)
        .bind(asset_id.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn persist_import(&self, record: ImportedFileRecord) -> Result<Asset, AssetError> {
        #[cfg(test)]
        if self.fail_persist.swap(false, Ordering::SeqCst) {
            return Err(AssetError::Database(sqlx::Error::Protocol(
                "asset persistence failpoint".to_owned(),
            )));
        }

        let scan_id = Uuid::new_v4();
        let mut transaction = self.pool.begin_with("BEGIN IMMEDIATE").await?;
        let existed: bool = sqlx::query_scalar(
            "SELECT EXISTS(
                SELECT 1 FROM indexed_files WHERE project_id = ? AND relative_path = ?
             )",
        )
        .bind(record.project_id.to_string())
        .bind(&record.relative_path)
        .fetch_one(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO scan_runs (
                id, project_id, watched_location_id, scan_type, status,
                files_discovered, files_added, files_updated, completed_at
             ) VALUES (?, ?, ?, 'watcher', 'completed', 1, ?, ?,
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
        )
        .bind(scan_id.to_string())
        .bind(record.project_id.to_string())
        .bind(record.watched_location_id.to_string())
        .bind(!existed)
        .bind(existed)
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            "INSERT INTO indexed_files (
                id, project_id, watched_location_id, relative_path, name, extension,
                mime_type, size_bytes, modified_at_ms, category, source_type, status,
                last_scan_id, managed, is_favorite, content_hash, hashed_size_bytes,
                hashed_modified_at_ms
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', 'active', ?, 1, ?, ?, ?, ?)
             ON CONFLICT(project_id, relative_path) DO UPDATE SET
                watched_location_id = excluded.watched_location_id,
                name = excluded.name, extension = excluded.extension,
                mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
                modified_at_ms = excluded.modified_at_ms, category = excluded.category,
                status = 'active', last_scan_id = excluded.last_scan_id, managed = 1,
                is_favorite = excluded.is_favorite, content_hash = excluded.content_hash,
                hashed_size_bytes = excluded.hashed_size_bytes,
                hashed_modified_at_ms = excluded.hashed_modified_at_ms,
                last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(record.project_id.to_string())
        .bind(record.watched_location_id.to_string())
        .bind(&record.relative_path)
        .bind(&record.name)
        .bind(&record.extension)
        .bind(&record.mime_type)
        .bind(to_i64(record.size_bytes)?)
        .bind(record.modified_at_ms)
        .bind(record.category.as_str())
        .bind(scan_id.to_string())
        .bind(record.favorite)
        .bind(&record.content_hash)
        .bind(to_i64(record.size_bytes)?)
        .bind(record.modified_at_ms)
        .execute(&mut *transaction)
        .await?;

        let asset_id: String = sqlx::query_scalar(
            "SELECT id FROM indexed_files WHERE project_id = ? AND relative_path = ?",
        )
        .bind(record.project_id.to_string())
        .bind(&record.relative_path)
        .fetch_one(&mut *transaction)
        .await?;
        let asset_id = parse_uuid(&asset_id)?;
        write_metadata(
            &mut transaction,
            record.project_id,
            asset_id,
            &record.tags,
            record.note.as_deref(),
            record.favorite,
            &[],
        )
        .await?;
        transaction.commit().await?;
        self.one(record.project_id, asset_id)
            .await?
            .ok_or(AssetError::InvalidPersistedData)
    }

    async fn update_metadata(&self, update: AssetMetadataUpdate) -> Result<Asset, AssetError> {
        let mut transaction = self.pool.begin_with("BEGIN IMMEDIATE").await?;
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM indexed_files WHERE id = ? AND project_id = ?)",
        )
        .bind(update.asset_id.to_string())
        .bind(update.project_id.to_string())
        .fetch_one(&mut *transaction)
        .await?;
        if !exists {
            return Err(AssetError::NotFound);
        }
        write_metadata(
            &mut transaction,
            update.project_id,
            update.asset_id,
            &update.tags,
            update.note.as_deref(),
            update.favorite,
            &update.variant_ids,
        )
        .await?;
        transaction.commit().await?;
        self.one(update.project_id, update.asset_id)
            .await?
            .ok_or(AssetError::InvalidPersistedData)
    }

    async fn variant_candidates(
        &self,
        query: &VariantCandidateQuery,
        current: &Asset,
        asset_root: &str,
        current_folder: &str,
    ) -> Result<VariantCandidateRecordsPage, AssetError> {
        let mut count = QueryBuilder::<Sqlite>::new(
            "SELECT COUNT(*) FROM indexed_files f WHERE f.project_id = ",
        );
        push_variant_filters(&mut count, query, asset_root, current_folder);
        let total_items = from_i64(
            count
                .build_query_scalar::<i64>()
                .fetch_one(&self.pool)
                .await?,
        )?;

        let mut items = QueryBuilder::<Sqlite>::new(VARIANT_SELECT);
        push_variant_filters(&mut items, query, asset_root, current_folder);
        push_variant_rank(&mut items, current, asset_root, current_folder);
        items.push(" LIMIT ").push_bind(i64::from(query.page_size));
        let offset = u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size);
        items.push(" OFFSET ").push_bind(to_i64(offset)?);
        let items = items
            .build_query_as::<VariantCandidateRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(TryInto::try_into)
            .collect::<Result<_, _>>()?;
        Ok(VariantCandidateRecordsPage { items, total_items })
    }

    async fn variant_by_relative_path(
        &self,
        project_id: Uuid,
        relative_path: &str,
    ) -> Result<Option<VariantCandidateRecord>, AssetError> {
        let mut query = QueryBuilder::<Sqlite>::new(VARIANT_SELECT);
        query.push_bind(project_id.to_string());
        query
            .push(" AND f.relative_path = ")
            .push_bind(relative_path);
        query
            .build_query_as::<VariantCandidateRow>()
            .fetch_optional(&self.pool)
            .await?
            .map(TryInto::try_into)
            .transpose()
    }

    async fn variants_for_asset(
        &self,
        project_id: Uuid,
        asset_id: Uuid,
    ) -> Result<Vec<VariantCandidateRecord>, AssetError> {
        let mut query = QueryBuilder::<Sqlite>::new(VARIANT_SELECT);
        query.push_bind(project_id.to_string());
        query.push(
            " AND EXISTS (
                SELECT 1 FROM asset_relations r
                WHERE r.project_id = f.project_id
                  AND ((r.primary_file_id = ",
        );
        query.push_bind(asset_id.to_string());
        query.push(" AND r.variant_file_id = f.id) OR (r.variant_file_id = ");
        query.push_bind(asset_id.to_string());
        query.push(" AND r.primary_file_id = f.id))) ORDER BY lower(f.relative_path), f.id");
        query
            .build_query_as::<VariantCandidateRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(TryInto::try_into)
            .collect()
    }

    async fn variant_records_by_ids(
        &self,
        project_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<VariantCandidateRecord>, AssetError> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut query = QueryBuilder::<Sqlite>::new(VARIANT_SELECT);
        query.push_bind(project_id.to_string());
        query.push(" AND f.id IN (");
        let mut separated = query.separated(", ");
        for id in ids {
            separated.push_bind(id.to_string());
        }
        separated.push_unseparated(") ORDER BY lower(f.relative_path), f.id");
        query
            .build_query_as::<VariantCandidateRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(TryInto::try_into)
            .collect()
    }

    async fn relation_edges_excluding(
        &self,
        project_id: Uuid,
        asset_id: Uuid,
    ) -> Result<Vec<(Uuid, Uuid)>, AssetError> {
        let rows = sqlx::query_as::<_, RelationEdgeRow>(
            "SELECT primary_file_id, variant_file_id FROM asset_relations
             WHERE project_id = ? AND primary_file_id <> ? AND variant_file_id <> ?",
        )
        .bind(project_id.to_string())
        .bind(asset_id.to_string())
        .bind(asset_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter()
            .map(|row| {
                Ok((
                    parse_uuid(&row.primary_file_id)?,
                    parse_uuid(&row.variant_file_id)?,
                ))
            })
            .collect()
    }

    async fn update_variants(&self, update: AssetVariantsUpdate) -> Result<Asset, AssetError> {
        let mut transaction = self.pool.begin_with("BEGIN IMMEDIATE").await?;
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM indexed_files WHERE id = ? AND project_id = ?)",
        )
        .bind(update.asset_id.to_string())
        .bind(update.project_id.to_string())
        .fetch_one(&mut *transaction)
        .await?;
        if !exists {
            return Err(AssetError::NotFound);
        }
        write_relations(
            &mut transaction,
            update.project_id,
            update.asset_id,
            &update.variant_ids,
        )
        .await?;
        sqlx::query(
            "UPDATE indexed_files SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ? AND project_id = ?",
        )
        .bind(update.asset_id.to_string())
        .bind(update.project_id.to_string())
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        self.one(update.project_id, update.asset_id)
            .await?
            .ok_or(AssetError::InvalidPersistedData)
    }
}

async fn write_metadata(
    transaction: &mut Transaction<'_, Sqlite>,
    project_id: Uuid,
    asset_id: Uuid,
    tags: &[String],
    note: Option<&str>,
    favorite: bool,
    variant_ids: &[Uuid],
) -> Result<(), AssetError> {
    sqlx::query("UPDATE indexed_files SET is_favorite = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND project_id = ?")
        .bind(favorite)
        .bind(asset_id.to_string())
        .bind(project_id.to_string())
        .execute(&mut **transaction)
        .await?;
    sqlx::query("DELETE FROM file_tags WHERE indexed_file_id = ?")
        .bind(asset_id.to_string())
        .execute(&mut **transaction)
        .await?;
    for tag in tags {
        let normalized = tag.to_lowercase();
        sqlx::query(
            "INSERT INTO asset_tags (id, project_id, name, normalized_name)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(project_id, normalized_name) DO UPDATE SET
                name = excluded.name, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(project_id.to_string())
        .bind(tag)
        .bind(&normalized)
        .execute(&mut **transaction)
        .await?;
        sqlx::query(
            "INSERT OR IGNORE INTO file_tags (indexed_file_id, tag_id)
             SELECT ?, id FROM asset_tags WHERE project_id = ? AND normalized_name = ?",
        )
        .bind(asset_id.to_string())
        .bind(project_id.to_string())
        .bind(normalized)
        .execute(&mut **transaction)
        .await?;
    }

    match note {
        Some(note) => {
            sqlx::query(
                "INSERT INTO file_notes (id, indexed_file_id, content) VALUES (?, ?, ?)
                 ON CONFLICT(indexed_file_id) DO UPDATE SET content = excluded.content,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(asset_id.to_string())
            .bind(note)
            .execute(&mut **transaction)
            .await?;
        }
        None => {
            sqlx::query("DELETE FROM file_notes WHERE indexed_file_id = ?")
                .bind(asset_id.to_string())
                .execute(&mut **transaction)
                .await?;
        }
    }

    write_relations(transaction, project_id, asset_id, variant_ids).await
}

async fn write_relations(
    transaction: &mut Transaction<'_, Sqlite>,
    project_id: Uuid,
    asset_id: Uuid,
    variant_ids: &[Uuid],
) -> Result<(), AssetError> {
    if !variant_ids.is_empty() {
        let unique = variant_ids.iter().copied().collect::<HashSet<_>>();
        let mut check =
            QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM indexed_files WHERE project_id = ");
        check.push_bind(project_id.to_string());
        check.push(" AND id IN (");
        let mut separated = check.separated(", ");
        for id in &unique {
            separated.push_bind(id.to_string());
        }
        separated.push_unseparated(")");
        let found: i64 = check
            .build_query_scalar()
            .fetch_one(&mut **transaction)
            .await?;
        if usize::try_from(found).ok() != Some(unique.len()) || unique.contains(&asset_id) {
            return Err(AssetError::InvalidMetadata);
        }
    }
    sqlx::query(
        "DELETE FROM asset_relations
         WHERE project_id = ? AND (primary_file_id = ? OR variant_file_id = ?)",
    )
    .bind(project_id.to_string())
    .bind(asset_id.to_string())
    .bind(asset_id.to_string())
    .execute(&mut **transaction)
    .await?;
    for variant_id in variant_ids.iter().copied().collect::<HashSet<_>>() {
        let (primary_id, variant_id) = if asset_id.as_bytes() < variant_id.as_bytes() {
            (asset_id, variant_id)
        } else {
            (variant_id, asset_id)
        };
        sqlx::query(
            "INSERT INTO asset_relations (id, project_id, primary_file_id, variant_file_id)
             VALUES (?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(project_id.to_string())
        .bind(primary_id.to_string())
        .bind(variant_id.to_string())
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}

fn push_filters(builder: &mut QueryBuilder<Sqlite>, query: &AssetQuery) {
    builder.push_bind(query.project_id.to_string());
    if let Some(search) = &query.search {
        let pattern = format!("%{}%", escape_like(search));
        builder
            .push(" AND (lower(f.name) LIKE lower(")
            .push_bind(pattern.clone());
        builder
            .push(") ESCAPE '\\' OR lower(f.relative_path) LIKE lower(")
            .push_bind(pattern);
        builder.push(") ESCAPE '\\')");
    }
    if let Some(category) = query.category {
        builder
            .push(" AND f.category = ")
            .push_bind(category.as_str());
    }
    if let Some(extension) = &query.extension {
        builder.push(" AND f.extension = ").push_bind(extension);
    }
    if let Some(favorite) = query.favorite {
        builder.push(" AND f.is_favorite = ").push_bind(favorite);
    }
    if let Some(origin) = query.origin {
        builder
            .push(" AND f.managed = ")
            .push_bind(matches!(origin, AssetOrigin::Managed));
    }
    if let Some(tag) = &query.tag {
        builder.push(" AND EXISTS (SELECT 1 FROM file_tags ft JOIN asset_tags t ON t.id = ft.tag_id WHERE ft.indexed_file_id = f.id AND t.normalized_name = ");
        builder.push_bind(tag);
        builder.push(")");
    }
}

fn push_variant_filters(
    builder: &mut QueryBuilder<Sqlite>,
    query: &VariantCandidateQuery,
    asset_root: &str,
    current_folder: &str,
) {
    builder.push_bind(query.project_id.to_string());
    builder.push(" AND f.status = 'active' AND f.id <> ");
    builder.push_bind(query.asset_id.to_string());
    if !query.excluded_ids.is_empty() {
        builder.push(" AND f.id NOT IN (");
        let mut separated = builder.separated(", ");
        for id in &query.excluded_ids {
            separated.push_bind(id.to_string());
        }
        separated.push_unseparated(")");
    }
    if let Some(search) = &query.search {
        let pattern = format!("%{}%", escape_like(search));
        builder
            .push(" AND (lower(f.name) LIKE lower(")
            .push_bind(pattern.clone());
        builder
            .push(") ESCAPE '\\' OR lower(f.relative_path) LIKE lower(")
            .push_bind(pattern);
        builder.push(") ESCAPE '\\')");
    }
    match query.scope {
        VariantCandidateScope::Suggested => {
            push_asset_root_filter(builder, asset_root);
            builder.push(" AND f.category NOT IN ('source', 'configuration')");
        }
        VariantCandidateScope::SameFolder => push_same_folder_filter(builder, current_folder),
        VariantCandidateScope::AssetRoot => push_asset_root_filter(builder, asset_root),
        VariantCandidateScope::Managed => {
            builder.push(" AND f.managed = 1");
        }
        VariantCandidateScope::All => {}
    }
}

fn push_variant_rank(
    builder: &mut QueryBuilder<Sqlite>,
    current: &Asset,
    asset_root: &str,
    current_folder: &str,
) {
    builder.push(" ORDER BY CASE WHEN ");
    push_same_folder_predicate(builder, current_folder);
    builder.push(" THEN 1 ELSE 0 END DESC, CASE WHEN ");
    push_asset_root_predicate(builder, asset_root);
    let stem = current
        .name
        .rsplit_once('.')
        .map_or(current.name.as_str(), |(stem, _)| stem);
    let similar_pattern = format!("%{}%", escape_like(&stem.to_lowercase()));
    builder
        .push(" THEN 1 ELSE 0 END DESC, CASE WHEN lower(f.name) LIKE ")
        .push_bind(similar_pattern);
    builder
        .push(" ESCAPE '\\' THEN 1 ELSE 0 END DESC, CASE WHEN f.category = ")
        .push_bind(current.category.as_str());
    builder.push(
        " THEN 1 ELSE 0 END DESC, CASE WHEN EXISTS (
            SELECT 1 FROM file_tags candidate_tag
            JOIN file_tags current_tag ON current_tag.tag_id = candidate_tag.tag_id
            WHERE candidate_tag.indexed_file_id = f.id
              AND current_tag.indexed_file_id = ",
    );
    builder.push_bind(current.id.to_string());
    builder.push(") THEN 1 ELSE 0 END DESC, f.managed DESC, lower(f.relative_path) ASC, f.id ASC");
}

fn push_same_folder_filter(builder: &mut QueryBuilder<Sqlite>, folder: &str) {
    builder.push(" AND ");
    push_same_folder_predicate(builder, folder);
}

fn push_same_folder_predicate(builder: &mut QueryBuilder<Sqlite>, folder: &str) {
    if folder == "." {
        builder.push("instr(f.relative_path, '/') = 0");
    } else {
        let prefix = format!("{}/", escape_like(folder));
        builder
            .push("(f.relative_path LIKE ")
            .push_bind(format!("{prefix}%"));
        builder
            .push(" ESCAPE '\\' AND f.relative_path NOT LIKE ")
            .push_bind(format!("{prefix}%/%"));
        builder.push(" ESCAPE '\\')");
    }
}

fn push_asset_root_filter(builder: &mut QueryBuilder<Sqlite>, asset_root: &str) {
    if asset_root != "." {
        builder.push(" AND ");
        push_asset_root_predicate(builder, asset_root);
    }
}

fn push_asset_root_predicate(builder: &mut QueryBuilder<Sqlite>, asset_root: &str) {
    if asset_root == "." {
        builder.push("1 = 1");
    } else {
        builder
            .push("(f.relative_path = ")
            .push_bind(asset_root.to_owned());
        builder
            .push(" OR f.relative_path LIKE ")
            .push_bind(format!("{}/%", escape_like(asset_root)));
        builder.push(" ESCAPE '\\')");
    }
}

fn push_order(builder: &mut QueryBuilder<Sqlite>, query: &AssetQuery) {
    builder.push(" ORDER BY ");
    match query.sort_by {
        AssetSortField::RelativePath => builder.push("lower(f.relative_path)"),
        AssetSortField::Name => builder.push("lower(f.name)"),
        AssetSortField::Category => builder.push("f.category"),
        AssetSortField::SizeBytes => builder.push("f.size_bytes"),
        AssetSortField::ModifiedAtMs => {
            builder.push("CASE WHEN f.modified_at_ms IS NULL THEN 1 ELSE 0 END, f.modified_at_ms")
        }
        AssetSortField::UpdatedAt => builder.push("f.updated_at"),
    };
    match query.sort_direction {
        SortDirection::Ascending => builder.push(" ASC"),
        SortDirection::Descending => builder.push(" DESC"),
    };
    builder.push(", lower(f.relative_path) ASC, f.id ASC");
}

#[derive(Debug, FromRow)]
struct AssetRow {
    id: String,
    project_id: String,
    relative_path: String,
    name: String,
    extension: Option<String>,
    mime_type: Option<String>,
    size_bytes: i64,
    modified_at_ms: Option<i64>,
    category: String,
    status: String,
    managed: bool,
    is_favorite: bool,
    updated_at: String,
    note: Option<String>,
    tags: String,
    variant_ids: String,
}

impl TryFrom<AssetRow> for Asset {
    type Error = AssetError;

    fn try_from(row: AssetRow) -> Result<Self, Self::Error> {
        if !matches!(row.status.as_str(), "active" | "missing") {
            return Err(AssetError::InvalidPersistedData);
        }
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            relative_path: row.relative_path,
            name: row.name,
            extension: row.extension,
            mime_type: row.mime_type,
            size_bytes: from_i64(row.size_bytes)?,
            modified_at_ms: row.modified_at_ms,
            category: FileCategory::try_from(row.category.as_str())
                .map_err(|_| AssetError::InvalidPersistedData)?,
            origin: if row.managed {
                AssetOrigin::Managed
            } else {
                AssetOrigin::Discovered
            },
            status: row.status,
            favorite: row.is_favorite,
            tags: split_group(&row.tags),
            note: row.note,
            variant_ids: split_group(&row.variant_ids)
                .into_iter()
                .map(|value| parse_uuid(&value))
                .collect::<Result<_, _>>()?,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct HashCandidateRow {
    id: String,
    relative_path: String,
    content_hash: Option<String>,
    hashed_size_bytes: Option<i64>,
    hashed_modified_at_ms: Option<i64>,
}

#[derive(Debug, FromRow)]
struct VariantCandidateRow {
    id: String,
    relative_path: String,
    name: String,
    extension: Option<String>,
    category: String,
    managed: bool,
    status: String,
    tags: String,
}

impl TryFrom<VariantCandidateRow> for VariantCandidateRecord {
    type Error = AssetError;

    fn try_from(row: VariantCandidateRow) -> Result<Self, Self::Error> {
        if !matches!(row.status.as_str(), "active" | "missing") {
            return Err(AssetError::InvalidPersistedData);
        }
        Ok(Self {
            id: parse_uuid(&row.id)?,
            relative_path: row.relative_path,
            name: row.name,
            extension: row.extension,
            category: FileCategory::try_from(row.category.as_str())
                .map_err(|_| AssetError::InvalidPersistedData)?,
            origin: if row.managed {
                AssetOrigin::Managed
            } else {
                AssetOrigin::Discovered
            },
            status: row.status,
            tags: split_group(&row.tags),
        })
    }
}

#[derive(Debug, FromRow)]
struct RelationEdgeRow {
    primary_file_id: String,
    variant_file_id: String,
}

impl TryFrom<HashCandidateRow> for HashCandidate {
    type Error = AssetError;
    fn try_from(row: HashCandidateRow) -> Result<Self, Self::Error> {
        Ok(Self {
            asset_id: parse_uuid(&row.id)?,
            relative_path: row.relative_path,
            content_hash: row.content_hash,
            hashed_size_bytes: row.hashed_size_bytes.map(from_i64).transpose()?,
            hashed_modified_at_ms: row.hashed_modified_at_ms,
        })
    }
}

fn split_group(value: &str) -> Vec<String> {
    value
        .split('\u{1f}')
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn parse_uuid(value: &str) -> Result<Uuid, AssetError> {
    Uuid::parse_str(value).map_err(|_| AssetError::InvalidPersistedData)
}

fn to_i64(value: u64) -> Result<i64, AssetError> {
    i64::try_from(value).map_err(|_| AssetError::InvalidPersistedData)
}

fn from_i64(value: i64) -> Result<u64, AssetError> {
    u64::try_from(value).map_err(|_| AssetError::InvalidPersistedData)
}
