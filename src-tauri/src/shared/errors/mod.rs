use std::io;

use sqlx::migrate::MigrateError;
use thiserror::Error;

pub(crate) mod command;

#[cfg(test)]
mod tests;

#[derive(Debug, Error)]
pub(crate) enum AppError {
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),

    #[error("database migration failed")]
    Migration(#[from] MigrateError),

    #[error("filesystem operation failed")]
    Filesystem(#[from] io::Error),

    #[error("database backup path is invalid")]
    InvalidBackupPath,

    #[error("database backup verification failed")]
    BackupVerification,

    #[error("invalid input: {0}")]
    InvalidInput(&'static str),

    #[error("persisted data is invalid: {0}")]
    InvalidPersistedData(&'static str),
}
