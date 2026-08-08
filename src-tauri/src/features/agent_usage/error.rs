use thiserror::Error;

use crate::shared::errors::command::CommandError;

#[derive(Debug, Error)]
pub(crate) enum AgentUsageError {
    #[error("agent account already exists")]
    DuplicateAccount,
    #[error("quota window already exists")]
    DuplicateQuota,
    #[error("agent usage input is invalid")]
    InvalidInput,
    #[error("agent usage record was not found")]
    NotFound,
    #[error("persisted agent usage data is invalid")]
    InvalidPersistedData,
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
}

impl From<AgentUsageError> for CommandError {
    fn from(error: AgentUsageError) -> Self {
        match error {
            AgentUsageError::DuplicateAccount => Self::agent_usage_conflict(
                "That platform, sign-in method, and account identifier are already tracked.",
            ),
            AgentUsageError::DuplicateQuota => Self::agent_usage_conflict(
                "That quota window label is already used for this account.",
            ),
            AgentUsageError::InvalidInput => {
                Self::invalid_input("The Agent Usage request contains invalid data.")
            }
            AgentUsageError::NotFound => {
                Self::not_found("The requested Agent Usage record could not be found.")
            }
            AgentUsageError::InvalidPersistedData | AgentUsageError::Database(_) => {
                Self::storage_unavailable()
            }
        }
    }
}
