use sqlx::query;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use tempfile::TempDir;

use super::AppState;
use crate::shared::database::DatabasePaths;

async fn create_legacy_database(paths: &DatabasePaths) {
    std::fs::create_dir_all(paths.data_directory()).expect("test data directory should exist");
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(paths.database_file())
                .create_if_missing(true),
        )
        .await
        .expect("legacy database should open");

    query("CREATE TABLE legacy_state (id INTEGER PRIMARY KEY)")
        .execute(&pool)
        .await
        .expect("legacy schema should be created");
    pool.close().await;
}

#[tokio::test]
async fn initializes_feature_repositories_over_the_managed_database() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let state = AppState::initialize(temp.path(), false)
        .await
        .expect("application state should initialize");

    let backup_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM backup_records")
        .fetch_one(state.database.pool())
        .await
        .expect("backup metadata should load");

    assert_eq!(backup_count, 0);
    state
        .verify_storage()
        .await
        .expect("managed database should be queryable");

    state.close().await;
}

#[tokio::test]
async fn records_the_snapshot_created_for_an_existing_database() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let paths = DatabasePaths::new(temp.path());
    create_legacy_database(&paths).await;

    let state = AppState::initialize(temp.path(), false)
        .await
        .expect("application state should initialize");
    let backup = sqlx::query_as::<_, (String, i64, i64)>(
        "SELECT file_name, from_version, to_version FROM backup_records",
    )
    .fetch_one(state.database.pool())
    .await
    .expect("backup metadata should load");

    assert_eq!(backup.1, 0);
    assert_eq!(backup.2, 15);
    assert!(paths.backups_directory().join(&backup.0).is_file());

    state.close().await;
}
