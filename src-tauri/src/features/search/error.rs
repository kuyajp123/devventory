use thiserror::Error;

use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum SearchError {
    #[error("search request is invalid")]
    InvalidInput,
    #[error("persisted search data is invalid")]
    InvalidPersistedData,
    #[error("search history entry was not found")]
    HistoryNotFound,
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("search history serialization failed")]
    Serialization(#[from] serde_json::Error),
}

impl From<SearchError> for CommandError {
    fn from(error: SearchError) -> Self {
        match error {
            SearchError::InvalidInput => {
                Self::invalid_input("The search request contains invalid filters.")
            }
            SearchError::HistoryNotFound => {
                Self::not_found("The requested search history entry could not be found.")
            }
            SearchError::Database(_)
            | SearchError::Serialization(_)
            | SearchError::InvalidPersistedData => Self::storage_unavailable(),
        }
    }
}
