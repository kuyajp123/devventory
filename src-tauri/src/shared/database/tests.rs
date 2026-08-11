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

async fn index_exists(pool: &sqlx::SqlitePool, index_name: &str) -> bool {
    query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?)",
    )
    .bind(index_name)
    .fetch_one(pool)
    .await
    .expect("index lookup should succeed")
}

async fn observed_name_column_exists(pool: &sqlx::SqlitePool) -> bool {
    query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM pragma_table_info('environment_key_occurrences')
            WHERE name = 'observed_name'
        )",
    )
    .fetch_one(pool)
    .await
    .expect("environment occurrence column lookup should succeed")
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
    assert!(table_exists(initialization.database.pool(), "asset_tags").await);
    assert!(table_exists(initialization.database.pool(), "file_tags").await);
    assert!(table_exists(initialization.database.pool(), "file_notes").await);
    assert!(table_exists(initialization.database.pool(), "asset_relations").await);
    assert!(table_exists(initialization.database.pool(), "environments").await);
    assert!(table_exists(initialization.database.pool(), "environment_sources").await);
    assert!(
        table_exists(
            initialization.database.pool(),
            "environment_key_definitions"
        )
        .await
    );
    assert!(
        table_exists(
            initialization.database.pool(),
            "environment_key_occurrences"
        )
        .await
    );
    assert!(
        index_exists(
            initialization.database.pool(),
            "environment_key_occurrences_matrix_idx"
        )
        .await
    );
    assert!(table_exists(initialization.database.pool(), "environment_key_rules").await);
    assert!(
        table_exists(
            initialization.database.pool(),
            "environment_key_rule_targets"
        )
        .await
    );
    assert!(table_exists(initialization.database.pool(), "validation_issues").await);
    assert!(table_exists(initialization.database.pool(), "project_validation_state").await);
    assert!(table_exists(initialization.database.pool(), "custom_environment_sources").await);
    assert!(table_exists(initialization.database.pool(), "custom_environment_keys").await);
    assert!(table_exists(initialization.database.pool(), "search_history").await);
    assert!(observed_name_column_exists(initialization.database.pool()).await);
    assert!(
        index_exists(
            initialization.database.pool(),
            "validation_issues_project_status_severity_idx"
        )
        .await
    );
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
    assert_eq!(snapshot.to_version, 13);

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

#[tokio::test]
async fn upgrades_a_database_that_already_applied_the_immutable_asset_migration() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let paths = DatabasePaths::new(temp.path());

    let initial = initialize_database(&paths)
        .await
        .expect("initial database should migrate");

    query("DROP TABLE IF EXISTS search_history")
        .execute(initial.database.pool())
        .await
        .expect("search history should be absent from the version 4 fixture");
    query("DROP INDEX IF EXISTS projects_name_nocase_idx")
        .execute(initial.database.pool())
        .await
        .expect("search project index should be absent from the version 4 fixture");
    query("DROP INDEX IF EXISTS indexed_files_project_path_nocase_idx")
        .execute(initial.database.pool())
        .await
        .expect("search path index should be absent from the version 4 fixture");
    query("DROP INDEX IF EXISTS indexed_files_project_modified_idx")
        .execute(initial.database.pool())
        .await
        .expect("search modified index should be absent from the version 4 fixture");
    query("DROP INDEX IF EXISTS indexed_files_project_size_idx")
        .execute(initial.database.pool())
        .await
        .expect("later optimization index should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS agent_reminders")
        .execute(initial.database.pool())
        .await
        .expect("agent reminders should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS agent_quota_windows")
        .execute(initial.database.pool())
        .await
        .expect("agent quotas should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS agent_accounts")
        .execute(initial.database.pool())
        .await
        .expect("agent accounts should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS project_validation_state")
        .execute(initial.database.pool())
        .await
        .expect("validation state should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS custom_environment_keys")
        .execute(initial.database.pool())
        .await
        .expect("custom environment keys should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS custom_environment_sources")
        .execute(initial.database.pool())
        .await
        .expect("custom environment sources should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS validation_issues")
        .execute(initial.database.pool())
        .await
        .expect("validation issues should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS environment_key_rule_targets")
        .execute(initial.database.pool())
        .await
        .expect("validation rule targets should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS environment_key_rules")
        .execute(initial.database.pool())
        .await
        .expect("validation rules should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS environment_key_occurrences")
        .execute(initial.database.pool())
        .await
        .expect("environment occurrences should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS environment_key_definitions")
        .execute(initial.database.pool())
        .await
        .expect("environment key definitions should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS environment_sources")
        .execute(initial.database.pool())
        .await
        .expect("environment sources should be absent from the version 4 fixture");
    query("DROP TABLE IF EXISTS environments")
        .execute(initial.database.pool())
        .await
        .expect("environments should be absent from the version 4 fixture");
    query("DELETE FROM _sqlx_migrations WHERE version >= 5")
        .execute(initial.database.pool())
        .await
        .expect("later migration rows should be removed from the version 4 fixture");
    query(
        "UPDATE _sqlx_migrations
         SET checksum = X'6c4b4fcef4bde3aea7ee83655aac7807c332303f1431dc355334d0f0e2b48d728436834a561d8e0b96730201383ebcd3'
         WHERE version = 4",
    )
    .execute(initial.database.pool())
    .await
    .expect("version 4 fixture should retain its originally applied checksum");
    initial.database.close().await;

    let upgraded = initialize_database(&paths)
        .await
        .expect("an existing version 4 database should upgrade without a checksum failure");
    let snapshot = upgraded
        .pre_migration_backup
        .as_ref()
        .expect("the existing database should be backed up before the latest migration");
    let latest_applied: i64 = query_scalar("SELECT MAX(version) FROM _sqlx_migrations")
        .fetch_one(upgraded.database.pool())
        .await
        .expect("latest migration version should load");

    assert_eq!(snapshot.from_version, 4);
    assert_eq!(snapshot.to_version, 13);
    assert!(snapshot.file_path.is_file());
    assert_eq!(latest_applied, 13);
    assert!(index_exists(upgraded.database.pool(), "indexed_files_project_size_idx").await);
    assert!(
        index_exists(
            upgraded.database.pool(),
            "environment_key_occurrences_matrix_idx"
        )
        .await
    );

    upgraded.database.close().await;
}
