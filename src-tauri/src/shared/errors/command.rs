use serde::Serialize;

use super::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum CommandErrorCode {
    InvalidInput,
    StorageUnavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandError {
    code: CommandErrorCode,
    message: &'static str,
    recoverable: bool,
}

impl CommandError {
    pub(crate) fn code(&self) -> &'static str {
        match self.code {
            CommandErrorCode::InvalidInput => "INVALID_INPUT",
            CommandErrorCode::StorageUnavailable => "STORAGE_UNAVAILABLE",
        }
    }
}

impl From<AppError> for CommandError {
    fn from(error: AppError) -> Self {
        match error {
            AppError::InvalidInput(_) => Self {
                code: CommandErrorCode::InvalidInput,
                message: "The request contains invalid data.",
                recoverable: true,
            },
            AppError::Database(_)
            | AppError::Migration(_)
            | AppError::Filesystem(_)
            | AppError::InvalidBackupPath
            | AppError::BackupVerification
            | AppError::InvalidPersistedData(_) => Self {
                code: CommandErrorCode::StorageUnavailable,
                message: "Local application data is unavailable.",
                recoverable: true,
            },
        }
    }
}
