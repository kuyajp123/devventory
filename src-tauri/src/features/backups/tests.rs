use sqlx::query_as;
use tempfile::TempDir;
use uuid::Uuid;

use crate::shared::database::{initialize_database, DatabasePaths};
use crate::shared::errors::AppError;

use super::repository::{BackupRecordDraft, BackupRepository, SqliteBackupRepository};

#[tokio::test]
async fn records_migration_backup_metadata() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let initialization = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database initialization should succeed");
    let repository = SqliteBackupRepository::new(initialization.database.pool().clone());
    let first_id = Uuid::new_v4();
    let second_id = Uuid::new_v4();

    let first = repository
        .record(BackupRecordDraft {
            id: first_id,
            file_name: "pre-migration-v0-to-v1-first.sqlite3".to_string(),
            from_version: 0,
            to_version: 1,
        })
        .await
        .expect("first backup should be recorded");
    let second = repository
        .record(BackupRecordDraft {
            id: second_id,
            file_name: "pre-migration-v0-to-v1-second.sqlite3".to_string(),
            from_version: 0,
            to_version: 1,
        })
        .await
        .expect("second backup should be recorded");

    let persisted = query_as::<_, (String, String, i64, i64)>(
        "SELECT id, file_name, from_version, to_version
         FROM backup_records
         ORDER BY rowid",
    )
    .fetch_all(initialization.database.pool())
    .await
    .expect("backup metadata should load");

    assert_eq!(first.id, first_id);
    assert_eq!(second.id, second_id);
    assert_eq!(first.file_name, "pre-migration-v0-to-v1-first.sqlite3");
    assert_eq!(second.from_version, 0);
    assert_eq!(second.to_version, 1);
    assert_eq!(persisted.len(), 2);
    assert_eq!(persisted[0].0, first_id.to_string());
    assert_eq!(persisted[1].0, second_id.to_string());
    assert_eq!(first.id.get_version_num(), 4);
    assert_eq!(second.id.get_version_num(), 4);

    initialization.database.close().await;
}

#[tokio::test]
async fn rejects_path_like_backup_file_names() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let initialization = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database initialization should succeed");
    let repository = SqliteBackupRepository::new(initialization.database.pool().clone());

    let error = repository
        .record(BackupRecordDraft {
            id: Uuid::new_v4(),
            file_name: "../outside.sqlite3".to_string(),
            from_version: 0,
            to_version: 1,
        })
        .await
        .expect_err("path-like file names should be rejected");

    assert!(matches!(error, AppError::InvalidInput(_)));

    initialization.database.close().await;
}
