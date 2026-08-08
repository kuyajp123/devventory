use sqlx::{query, SqlitePool};
use tempfile::tempdir;
use uuid::Uuid;

use crate::shared::database::{initialize_database, DatabasePaths};

use crate::features::file_inventory::{FileCategory, FileStatus};

use super::error::SearchError;
use super::model::{
    SearchMetadataRequest, SearchOrigin, SearchResult, SearchSortDirection, SearchSortField,
};
use super::{SearchService, SqliteSearchRepository};

fn request(query: &str) -> SearchMetadataRequest {
    SearchMetadataRequest {
        query: query.to_owned(),
        project_id: None,
        page: 1,
        page_size: 25,
        sort_by: SearchSortField::Relevance,
        sort_direction: SearchSortDirection::Ascending,
        categories: vec![],
        extensions: vec![],
        tags: vec![],
        environment_ids: vec![],
        statuses: vec![],
        origins: vec![],
        modified_from_ms: None,
        modified_to_ms: None,
    }
}

async fn insert_project(pool: &SqlitePool, id: Uuid, name: &str) -> Uuid {
    query(
        "INSERT INTO projects (id, name, project_type, root_path, root_path_key)
         VALUES (?, ?, 'desktop', ?, ?)",
    )
    .bind(id.to_string())
    .bind(name)
    .bind(format!("C:/workspace/{id}"))
    .bind(format!("c:/workspace/{id}"))
    .execute(pool)
    .await
    .expect("project row");
    query(
        "INSERT INTO initial_scan_summaries (
            id, project_id, files_discovered, directories_visited, entries_excluded,
            entries_unreadable, duration_ms, completed
         ) VALUES (?, ?, 0, 0, 0, 0, 0, 1)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(id.to_string())
    .execute(pool)
    .await
    .expect("scan summary");
    let watched_id = Uuid::new_v4();
    query("INSERT INTO watched_locations (id, project_id, relative_path) VALUES (?, ?, '.')")
        .bind(watched_id.to_string())
        .bind(id.to_string())
        .execute(pool)
        .await
        .expect("watched location");
    watched_id
}

async fn insert_scan(pool: &SqlitePool, project_id: Uuid) -> Uuid {
    let scan_id = Uuid::new_v4();
    query(
        "INSERT INTO scan_runs (id, project_id, scan_type, status)
         VALUES (?, ?, 'initial', 'completed')",
    )
    .bind(scan_id.to_string())
    .bind(project_id.to_string())
    .execute(pool)
    .await
    .expect("scan run");
    scan_id
}

#[tokio::test]
async fn searches_safe_metadata_across_projects_files_assets_and_environment_keys() {
    let workspace = tempdir().expect("temporary workspace");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool();
    let project_id = Uuid::new_v4();
    let watched_id = insert_project(pool, project_id, "Devventory Unicode Ω").await;
    let scan_id = insert_scan(pool, project_id).await;
    let file_id = Uuid::new_v4();
    query(
        "INSERT INTO indexed_files (
            id, project_id, watched_location_id, relative_path, name, extension, size_bytes,
            modified_at_ms, category, source_type, status, last_scan_id, managed
         ) VALUES (?, ?, ?, 'assets/branding/logo-dark.png', 'logo-dark.png', 'png', 42,
                   1770000000000, 'image', 'discovered', 'active', ?, 1)",
    )
    .bind(file_id.to_string())
    .bind(project_id.to_string())
    .bind(watched_id.to_string())
    .bind(scan_id.to_string())
    .execute(pool)
    .await
    .expect("indexed file");
    let tag_id = Uuid::new_v4();
    query(
        "INSERT INTO asset_tags (id, project_id, name, normalized_name)
         VALUES (?, ?, 'Brand', 'brand')",
    )
    .bind(tag_id.to_string())
    .bind(project_id.to_string())
    .execute(pool)
    .await
    .expect("tag");
    query("INSERT INTO file_tags (indexed_file_id, tag_id) VALUES (?, ?)")
        .bind(file_id.to_string())
        .bind(tag_id.to_string())
        .execute(pool)
        .await
        .expect("file tag");
    query("INSERT INTO file_notes (id, indexed_file_id, content) VALUES (?, ?, 'Primary emblem')")
        .bind(Uuid::new_v4().to_string())
        .bind(file_id.to_string())
        .execute(pool)
        .await
        .expect("file note");

    let environment_id = Uuid::new_v4();
    query(
        "INSERT INTO environments (id, project_id, name, normalized_name, sort_order)
         VALUES (?, ?, 'Production', 'production', 0)",
    )
    .bind(environment_id.to_string())
    .bind(project_id.to_string())
    .execute(pool)
    .await
    .expect("environment");
    let source_id = Uuid::new_v4();
    query(
        "INSERT INTO environment_sources (
            id, project_id, environment_id, relative_path, normalized_path, sort_order, parse_status
         ) VALUES (?, ?, ?, '.env.production', '.env.production', 0, 'parsed')",
    )
    .bind(source_id.to_string())
    .bind(project_id.to_string())
    .bind(environment_id.to_string())
    .execute(pool)
    .await
    .expect("environment source");
    let key_id = Uuid::new_v4();
    query(
        "INSERT INTO environment_key_definitions (id, project_id, name, normalized_name)
         VALUES (?, ?, 'PUBLIC_API_URL', 'PUBLIC_API_URL')",
    )
    .bind(key_id.to_string())
    .bind(project_id.to_string())
    .execute(pool)
    .await
    .expect("key definition");
    query(
        "INSERT INTO environment_key_occurrences (
            id, project_id, environment_id, source_id, key_definition_id, line_number,
            is_commented, observed_name
         ) VALUES (?, ?, ?, ?, ?, 1, 0, 'PUBLIC_API_URL')",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(project_id.to_string())
    .bind(environment_id.to_string())
    .bind(source_id.to_string())
    .bind(key_id.to_string())
    .execute(pool)
    .await
    .expect("key occurrence");

    let service = SearchService::new(SqliteSearchRepository::new(pool.clone()));
    let logo = service.search(request("LoGo")).await.expect("logo search");
    assert_eq!(logo.total_items, 1);
    assert!(matches!(
        &logo.items[0],
        SearchResult::File { origin: SearchOrigin::Managed, tags, note: Some(note), .. }
            if tags == &["Brand"] && note == "Primary emblem"
    ));
    let key = service
        .search(request("public_api"))
        .await
        .expect("environment-key search");
    assert!(matches!(
        &key.items[0],
        SearchResult::EnvironmentKey { environment_name, .. } if environment_name == "Production"
    ));
    let project = service
        .search(request("unicode Ω"))
        .await
        .expect("unicode project search");
    assert!(matches!(project.items[0], SearchResult::Project { .. }));

    for query_text in ["assets/branding", "png", "brand", "emblem"] {
        let result = service
            .search(request(query_text))
            .await
            .expect("safe metadata search");
        assert_eq!(result.total_items, 1, "query {query_text}");
        assert!(matches!(result.items[0], SearchResult::File { .. }));
    }

    let mut tag_filter = request("");
    tag_filter.project_id = Some(project_id.to_string());
    tag_filter.tags = vec!["BRAND".to_owned()];
    assert_eq!(
        service
            .search(tag_filter)
            .await
            .expect("tag filter")
            .total_items,
        1
    );
    let mut invalid_environment = request("PUBLIC_API_URL");
    invalid_environment.project_id = Some(project_id.to_string());
    invalid_environment.environment_ids = vec![Uuid::new_v4().to_string()];
    assert!(matches!(
        service.search(invalid_environment).await,
        Err(SearchError::InvalidInput)
    ));
    let mut environment_filter = request("PUBLIC_API_URL");
    environment_filter.project_id = Some(project_id.to_string());
    environment_filter.environment_ids = vec![environment_id.to_string()];
    assert_eq!(
        service
            .search(environment_filter)
            .await
            .expect("environment filter")
            .total_items,
        1
    );
    assert_eq!(
        service
            .search(request("   "))
            .await
            .expect("whitespace search")
            .total_items,
        3
    );

    initialization.database.close().await;
}

#[tokio::test]
async fn treats_sql_metacharacters_as_text_and_keeps_pages_bounded() {
    let workspace = tempdir().expect("temporary workspace");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool();
    let project_id = Uuid::new_v4();
    let watched_id = insert_project(pool, project_id, "Large project").await;
    let scan_id = insert_scan(pool, project_id).await;
    let mut transaction = pool.begin().await.expect("fixture transaction");
    for index in 0..1_250 {
        query(
            "INSERT INTO indexed_files (
                id, project_id, watched_location_id, relative_path, name, extension, size_bytes,
                modified_at_ms, category, source_type, status, last_scan_id, managed
             ) VALUES (?, ?, ?, ?, ?, 'ts', 1, ?, 'source', 'discovered', 'active', ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(project_id.to_string())
        .bind(watched_id.to_string())
        .bind(format!("src/module-{index:04}.ts"))
        .bind(format!("module-{index:04}.ts"))
        .bind(1_700_000_000_000_i64 + index)
        .bind(scan_id.to_string())
        .bind(index % 2 == 0)
        .execute(&mut *transaction)
        .await
        .expect("large file fixture");
    }
    transaction.commit().await.expect("fixture commit");
    let service = SearchService::new(SqliteSearchRepository::new(pool.clone()));

    let hostile = service
        .search(request("' OR 1=1 -- %_\\"))
        .await
        .expect("hostile-looking search text");
    assert_eq!(hostile.total_items, 0);

    let mut filtered = request("module");
    filtered.project_id = Some(project_id.to_string());
    filtered.page = 3;
    filtered.page_size = 25;
    filtered.extensions = vec![".TS".to_owned()];
    filtered.categories = vec![FileCategory::Source];
    filtered.statuses = vec![FileStatus::Active];
    filtered.origins = vec![SearchOrigin::Managed];
    filtered.modified_from_ms = Some(1_700_000_000_000);
    filtered.modified_to_ms = Some(1_700_000_001_249);
    filtered.sort_by = SearchSortField::Modified;
    filtered.sort_direction = SearchSortDirection::Descending;
    let page = service
        .search(filtered.clone())
        .await
        .expect("bounded page");
    assert_eq!(page.items.len(), 25);
    assert_eq!(page.total_items, 625);
    assert_eq!(page.page, 3);
    assert!(page.has_more);

    let repeated = service.search(filtered.clone()).await.expect("repeat page");
    assert_eq!(page.items, repeated.items);

    let mut discovered = filtered.clone();
    discovered.origins = vec![SearchOrigin::Discovered];
    assert_eq!(
        service
            .search(discovered)
            .await
            .expect("discovered filter")
            .total_items,
        625
    );

    let mut oversized = request("module");
    oversized.page_size = 101;
    assert!(matches!(
        service.search(oversized).await,
        Err(SearchError::InvalidInput)
    ));

    let plans = sqlx::query_as::<_, (i64, i64, i64, String)>(
        "EXPLAIN QUERY PLAN
         SELECT id FROM indexed_files
         WHERE project_id = ? AND status = 'active'
         ORDER BY relative_path LIMIT 25",
    )
    .bind(project_id.to_string())
    .fetch_all(pool)
    .await
    .expect("representative search query plan")
    .into_iter()
    .map(|(_, _, _, detail)| detail)
    .collect::<Vec<_>>();
    assert!(plans
        .iter()
        .any(|detail| detail.contains("indexed_files_project_status_path_idx")));

    initialization.database.close().await;
}

#[tokio::test]
async fn search_history_is_meaningful_deduplicated_bounded_and_project_owned() {
    let workspace = tempdir().expect("temporary workspace");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool();
    let project_id = Uuid::new_v4();
    insert_project(pool, project_id, "History project").await;
    let service = SearchService::new(SqliteSearchRepository::new(pool.clone()));

    assert!(service
        .record_history(request("   "))
        .await
        .expect("empty history request")
        .is_none());
    for index in 0..24 {
        let mut item = request(&format!("query {index}"));
        item.project_id = Some(project_id.to_string());
        service
            .record_history(item)
            .await
            .expect("history insertion");
    }
    let reused = {
        let mut item = request("query 4");
        item.project_id = Some(project_id.to_string());
        service
            .record_history(item)
            .await
            .expect("history reuse")
            .expect("meaningful history")
    };
    let history = service.history().await.expect("history list");
    assert_eq!(history.len(), 20);
    assert_eq!(history[0].id, reused.id);
    assert_eq!(history[0].request.query, "query 4");

    service
        .delete_history(reused.id.to_string())
        .await
        .expect("history deletion");
    assert_eq!(service.history().await.expect("history list").len(), 19);
    service.clear_history().await.expect("history clear");
    assert!(service.history().await.expect("empty history").is_empty());

    initialization.database.close().await;
}
