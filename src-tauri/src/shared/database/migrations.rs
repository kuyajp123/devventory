use std::collections::HashSet;

use sqlx::migrate::Migrator;
use sqlx::{query_scalar, SqlitePool};

use crate::shared::errors::AppError;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub(super) fn latest_version() -> i64 {
    MIGRATOR
        .iter()
        .map(|migration| migration.version)
        .max()
        .unwrap_or(0)
}

pub(super) async fn applied_versions(pool: &SqlitePool) -> Result<HashSet<i64>, AppError> {
    let migration_table_exists: bool = query_scalar(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations')",
    )
    .fetch_one(pool)
    .await?;

    if !migration_table_exists {
        return Ok(HashSet::new());
    }

    let versions = query_scalar::<_, i64>(
        "SELECT version FROM _sqlx_migrations WHERE success = TRUE ORDER BY version",
    )
    .fetch_all(pool)
    .await?;

    Ok(versions.into_iter().collect())
}

pub(super) fn has_pending(applied_versions: &HashSet<i64>) -> bool {
    MIGRATOR
        .iter()
        .any(|migration| !applied_versions.contains(&migration.version))
}

pub(super) async fn run(pool: &SqlitePool) -> Result<(), AppError> {
    MIGRATOR.run(pool).await?;
    Ok(())
}
