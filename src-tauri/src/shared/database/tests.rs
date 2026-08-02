use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{query, query_scalar};
use tempfile::TempDir;

use super::{initialize_database, DatabasePaths};

async fn table_exists(pool: &sqlx::SqlitePool, table_name: &str) -> bool {
    query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?)",
    )
    .bind(table_name)
    .fetch_one(pool)
    .await
    .expect("table lookup should succeed")
}

async fn create_unmigrated_database(paths: &DatabasePaths) {
    std::fs::create_dir_all(paths.data_directory()).expect("test data directory should exist");

    let options = SqliteConnectOptions::new()
        .filename(paths.database_file())
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .expect("legacy database should open");

    query("CREATE TABLE legacy_marker (value TEXT NOT NULL)")
        .execute(&pool)
        .await
        .expect("legacy table should be created");
    query("INSERT INTO legacy_marker (value) VALUES (?)")
        .bind("preserved")
        .execute(&pool)
        .await
        .expect("legacy row should be inserted");

    pool.close().await;
}

#[tokio::test]
async fn initializes_the_foundation_schema_without_a_first_run_backup() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let paths = DatabasePaths::new(temp.path());

    let initialization = initialize_database(&paths)
        .await
        .expect("database initialization should succeed");

    assert!(initialization.pre_migration_backup.is_none());
    assert!(table_exists(initialization.database.pool(), "application_settings").await);
    assert!(table_exists(initialization.database.pool(), "backup_records").await);
    assert!(table_exists(initialization.database.pool(), "projects").await);
    assert!(table_exists(initialization.database.pool(), "watched_locations").await);
    assert!(table_exists(initialization.database.pool(), "project_exclusions").await);
    assert!(table_exists(initialization.database.pool(), "initial_scan_summaries").await);
    assert!(table_exists(initialization.database.pool(), "indexed_files").await);
    assert!(table_exists(initialization.database.pool(), "scan_runs").await);
    assert!(table_exists(initialization.database.pool(), "_sqlx_migrations").await);

    let journal_mode: String = query_scalar("PRAGMA journal_mode")
        .fetch_one(initialization.database.pool())
        .await
        .expect("journal mode should load");
    let foreign_keys: i64 = query_scalar("PRAGMA foreign_keys")
        .fetch_one(initialization.database.pool())
        .await
        .expect("foreign-key mode should load");

    assert_eq!(journal_mode, "wal");
    assert_eq!(foreign_keys, 1);

    initialization.database.close().await;
}

#[tokio::test]
async fn snapshots_an_existing_database_before_applying_pending_migrations() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let paths = DatabasePaths::new(temp.path());
    create_unmigrated_database(&paths).await;

    let initialization = initialize_database(&paths)
        .await
        .expect("database initialization should succeed");
    let snapshot = initialization
        .pre_migration_backup
        .as_ref()
        .expect("a pre-migration snapshot should be created");

    assert_eq!(snapshot.id.get_version_num(), 4);
    assert!(snapshot.file_path.starts_with(paths.backups_directory()));
    assert!(snapshot.file_path.is_file());
    assert_eq!(snapshot.from_version, 0);
    assert_eq!(snapshot.to_version, 3);

    let backup_options = SqliteConnectOptions::new()
        .filename(&snapshot.file_path)
        .read_only(true);
    let backup_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(backup_options)
        .await
        .expect("snapshot should open");
    let preserved_value: String = query_scalar("SELECT value FROM legacy_marker LIMIT 1")
        .fetch_one(&backup_pool)
        .await
        .expect("snapshot should contain legacy data");

    assert_eq!(preserved_value, "preserved");
    assert!(!table_exists(&backup_pool, "application_settings").await);

    backup_pool.close().await;
    initialization.database.close().await;
}

#[tokio::test]
async fn does_not_snapshot_a_database_with_no_pending_migrations() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let paths = DatabasePaths::new(temp.path());

    let first = initialize_database(&paths)
        .await
        .expect("first initialization should succeed");
    first.database.close().await;

    let second = initialize_database(&paths)
        .await
        .expect("second initialization should succeed");

    assert!(second.pre_migration_backup.is_none());

    second.database.close().await;
}
