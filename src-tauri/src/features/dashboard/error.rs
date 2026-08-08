use thiserror::Error;

use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum DashboardError {
    #[error("dashboard request is invalid")]
    InvalidInput,
    #[error("project was not found")]
    ProjectNotFound,
    #[error("persisted dashboard data is invalid")]
    InvalidPersistedData,
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
}

impl From<DashboardError> for CommandError {
    fn from(error: DashboardError) -> Self {
        match error {
            DashboardError::InvalidInput => {
                Self::invalid_input("The dashboard request contains an invalid project ID.")
            }
            DashboardError::ProjectNotFound => {
                Self::not_found("The requested project could not be found.")
            }
            DashboardError::Database(_) | DashboardError::InvalidPersistedData => {
                Self::storage_unavailable()
            }
        }
    }
}
