use sqlx::{query, SqlitePool};
use tempfile::tempdir;
use uuid::Uuid;

use crate::shared::database::{initialize_database, DatabasePaths};

use super::error::DashboardError;
use super::{DashboardService, SqliteDashboardRepository};

async fn insert_project(pool: &SqlitePool, name: &str) -> Uuid {
    let id = Uuid::new_v4();
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
    .expect("project fixture");
    query("INSERT INTO watched_locations (id, project_id, relative_path) VALUES (?, ?, '.')")
        .bind(Uuid::new_v4().to_string())
        .bind(id.to_string())
        .execute(pool)
        .await
        .expect("watched location fixture");
    id
}

async fn insert_scan(pool: &SqlitePool, project_id: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    query(
        "INSERT INTO scan_runs (
            id, project_id, scan_type, status, files_discovered, files_added,
            files_updated, files_missing, duration_ms, started_at
         ) VALUES (?, ?, 'manual_project', 'completed', 3, 2, 1, 1, 24,
                   '2026-08-09T01:00:00.000Z')",
    )
    .bind(id.to_string())
    .bind(project_id.to_string())
    .execute(pool)
    .await
    .expect("scan fixture");
    id
}

#[tokio::test]
async fn dashboard_returns_project_scoped_aggregates_without_raw_records() {
    let workspace = tempdir().expect("temporary workspace");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool();
    let project_id = insert_project(pool, "Dashboard project").await;
    let other_project_id = insert_project(pool, "Other project").await;
    let scan_id = insert_scan(pool, project_id).await;
    let watched_id: String =
        sqlx::query_scalar("SELECT id FROM watched_locations WHERE project_id = ? LIMIT 1")
            .bind(project_id.to_string())
            .fetch_one(pool)
            .await
            .expect("watched location id");

    for (path, category, status, managed) in [
        ("src/main.ts", "source", "active", false),
        ("assets/logo.png", "image", "active", true),
        ("docs/missing.md", "document", "missing", false),
    ] {
        query(
            "INSERT INTO indexed_files (
                id, project_id, watched_location_id, relative_path, name, extension,
                size_bytes, category, source_type, status, last_scan_id, managed
             ) VALUES (?, ?, ?, ?, ?, 'x', 1, ?, 'discovered', ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(project_id.to_string())
        .bind(&watched_id)
        .bind(path)
        .bind(path.rsplit('/').next().expect("file name"))
        .bind(category)
        .bind(status)
        .bind(scan_id.to_string())
        .bind(managed)
        .execute(pool)
        .await
        .expect("file fixture");
    }

    let environment_id = Uuid::new_v4();
    query(
        "INSERT INTO environments (id, project_id, name, normalized_name, sort_order)
         VALUES (?, ?, 'Production', 'production', 0)",
    )
    .bind(environment_id.to_string())
    .bind(project_id.to_string())
    .execute(pool)
    .await
    .expect("environment fixture");
    let source_id = Uuid::new_v4();
    query(
        "INSERT INTO environment_sources (
            id, project_id, environment_id, relative_path, normalized_path, sort_order, parse_status
         ) VALUES (?, ?, ?, '.env', '.env', 0, 'unreadable')",
    )
    .bind(source_id.to_string())
    .bind(project_id.to_string())
    .bind(environment_id.to_string())
    .execute(pool)
    .await
    .expect("source fixture");
    let present_key_id = Uuid::new_v4();
    let absent_key_id = Uuid::new_v4();
    for (id, name) in [(present_key_id, "API_URL"), (absent_key_id, "TOKEN_NAME")] {
        query(
            "INSERT INTO environment_key_definitions (id, project_id, name, normalized_name)
             VALUES (?, ?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(project_id.to_string())
        .bind(name)
        .bind(name)
        .execute(pool)
        .await
        .expect("key fixture");
    }
    query(
        "INSERT INTO environment_key_occurrences (
            id, project_id, environment_id, source_id, key_definition_id, line_number,
            is_commented, observed_name
         ) VALUES (?, ?, ?, ?, ?, 1, 0, 'API_URL')",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(project_id.to_string())
    .bind(environment_id.to_string())
    .bind(source_id.to_string())
    .bind(present_key_id.to_string())
    .execute(pool)
    .await
    .expect("occurrence fixture");
    query(
        "INSERT INTO validation_issues (
            id, project_id, fingerprint, key_name, normalized_key, issue_type, severity,
            status, message, last_seen_run_id
         ) VALUES (?, ?, ?, 'TOKEN_NAME', 'TOKEN_NAME', 'required_missing', 'error',
                   'open', 'Required key is missing.', ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(project_id.to_string())
    .bind("a".repeat(64))
    .bind(Uuid::new_v4().to_string())
    .execute(pool)
    .await
    .expect("validation fixture");

    let other_scan = insert_scan(pool, other_project_id).await;
    assert_ne!(scan_id, other_scan);

    let service = DashboardService::new(SqliteDashboardRepository::new(pool.clone()));
    let dashboard = service
        .get(project_id.to_string())
        .await
        .expect("dashboard aggregates");
    assert_eq!(dashboard.project_id, project_id);
    assert_eq!(dashboard.metrics.indexed_files, 3);
    assert_eq!(dashboard.metrics.missing_files, 1);
    assert_eq!(dashboard.metrics.managed_assets, 1);
    assert_eq!(dashboard.metrics.environments, 1);
    assert_eq!(dashboard.metrics.environment_keys, 2);
    assert_eq!(dashboard.metrics.open_validation_issues, 1);
    assert_eq!(dashboard.metrics.watched_locations, 1);
    assert_eq!(dashboard.file_categories.len(), 3);
    assert_eq!(dashboard.validation_severities[0].count, 1);
    assert_eq!(dashboard.environment_coverage[0].known_keys, 2);
    assert_eq!(dashboard.environment_coverage[0].present_keys, 1);
    assert_eq!(
        dashboard.environment_coverage[0].coverage_percent,
        Some(50.0)
    );
    assert_eq!(dashboard.environment_coverage[0].unavailable_sources, 1);
    assert_eq!(dashboard.recent_scans.len(), 1);

    initialization.database.close().await;
}

#[tokio::test]
async fn dashboard_validates_project_ids_and_returns_empty_series_for_a_new_project() {
    let workspace = tempdir().expect("temporary workspace");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool();
    let project_id = insert_project(pool, "Empty project").await;
    let service = DashboardService::new(SqliteDashboardRepository::new(pool.clone()));

    let dashboard = service
        .get(project_id.to_string())
        .await
        .expect("empty dashboard");
    assert_eq!(dashboard.metrics.indexed_files, 0);
    assert!(dashboard.file_categories.is_empty());
    assert!(dashboard.validation_severities.is_empty());
    assert!(dashboard.environment_coverage.is_empty());
    assert!(dashboard.recent_scans.is_empty());
    assert!(matches!(
        service.get("not-a-uuid".to_owned()).await,
        Err(DashboardError::InvalidInput)
    ));
    assert!(matches!(
        service.get(Uuid::new_v4().to_string()).await,
        Err(DashboardError::ProjectNotFound)
    ));
    query("DELETE FROM projects WHERE id = ?")
        .bind(project_id.to_string())
        .execute(pool)
        .await
        .expect("project deletion");
    assert!(matches!(
        service.get(project_id.to_string()).await,
        Err(DashboardError::ProjectNotFound)
    ));

    initialization.database.close().await;
}

#[tokio::test]
async fn dashboard_aggregates_a_large_fixture_without_returning_raw_files() {
    let workspace = tempdir().expect("temporary workspace");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool();
    let project_id = insert_project(pool, "Large dashboard project").await;
    let scan_id = insert_scan(pool, project_id).await;
    let watched_id: String =
        sqlx::query_scalar("SELECT id FROM watched_locations WHERE project_id = ? LIMIT 1")
            .bind(project_id.to_string())
            .fetch_one(pool)
            .await
            .expect("watched location id");
    let mut transaction = pool.begin().await.expect("large fixture transaction");
    for index in 0..2_000 {
        query(
            "INSERT INTO indexed_files (
                id, project_id, watched_location_id, relative_path, name, extension,
                size_bytes, category, source_type, status, last_scan_id
             ) VALUES (?, ?, ?, ?, ?, 'ts', 1, 'source', 'discovered', 'active', ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(project_id.to_string())
        .bind(&watched_id)
        .bind(format!("src/module-{index:04}.ts"))
        .bind(format!("module-{index:04}.ts"))
        .bind(scan_id.to_string())
        .execute(&mut *transaction)
        .await
        .expect("large file fixture");
    }
    transaction.commit().await.expect("large fixture commit");

    let dashboard = DashboardService::new(SqliteDashboardRepository::new(pool.clone()))
        .get(project_id.to_string())
        .await
        .expect("large dashboard aggregate");
    assert_eq!(dashboard.metrics.indexed_files, 2_000);
    assert_eq!(dashboard.file_categories.len(), 1);
    assert_eq!(dashboard.file_categories[0].count, 2_000);

    initialization.database.close().await;
}
