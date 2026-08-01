use sqlx::query;
use tempfile::TempDir;
use uuid::Uuid;

use crate::shared::database::{initialize_database, DatabasePaths};

use super::repository::{SettingsRepository, SqliteSettingsRepository};

#[tokio::test]
async fn reads_a_persisted_setting_through_the_repository_contract() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let initialization = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database initialization should succeed");
    let repository = SqliteSettingsRepository::new(initialization.database.pool().clone());
    let id = Uuid::new_v4();

    query(
        "INSERT INTO application_settings (id, setting_key, setting_value)
         VALUES (?, ?, ?)",
    )
    .bind(id.to_string())
    .bind("navigation.density")
    .bind("compact")
    .execute(initialization.database.pool())
    .await
    .expect("test setting should be inserted");

    let found = repository
        .find_by_key("navigation.density")
        .await
        .expect("setting lookup should succeed")
        .expect("setting should exist");

    assert_eq!(found.id, id);
    assert_eq!(found.key, "navigation.density");
    assert_eq!(found.value, "compact");
    assert_eq!(found.id.get_version_num(), 4);

    initialization.database.close().await;
}

#[tokio::test]
async fn treats_query_shaped_setting_keys_as_data() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let initialization = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database initialization should succeed");
    let repository = SqliteSettingsRepository::new(initialization.database.pool().clone());
    let id = Uuid::new_v4();
    let key = "' OR 1 = 1 --";

    query(
        "INSERT INTO application_settings (id, setting_key, setting_value)
         VALUES (?, ?, ?)",
    )
    .bind(id.to_string())
    .bind(key)
    .bind("preserved")
    .execute(initialization.database.pool())
    .await
    .expect("test setting should be inserted");

    let found = repository
        .find_by_key(key)
        .await
        .expect("setting lookup should succeed")
        .expect("setting should exist");

    assert_eq!(found.id, id);
    assert_eq!(found.key, key);
    assert_eq!(found.value, "preserved");

    initialization.database.close().await;
}
