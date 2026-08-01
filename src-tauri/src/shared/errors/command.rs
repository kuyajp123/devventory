use serde::Serialize;

use super::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum CommandErrorCode {
    FilesystemUnavailable,
    InvalidInput,
    NotFound,
    PathOutsideRoot,
    ProjectRootConflict,
    RootNotDirectory,
    RootNotFound,
    StorageUnavailable,
    WatchedLocationInvalid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandError {
    code: CommandErrorCode,
    message: &'static str,
    recoverable: bool,
}

impl CommandError {
    pub(crate) fn filesystem_unavailable(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::FilesystemUnavailable,
            message,
            recoverable: true,
        }
    }

    pub(crate) fn invalid_input(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::InvalidInput,
            message,
            recoverable: true,
        }
    }

    pub(crate) fn not_found(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::NotFound,
            message,
            recoverable: true,
        }
    }

    pub(crate) fn project_root_conflict() -> Self {
        Self {
            code: CommandErrorCode::ProjectRootConflict,
            message: "That project folder is already registered.",
            recoverable: true,
        }
    }

    pub(crate) fn path_outside_root() -> Self {
        Self {
            code: CommandErrorCode::PathOutsideRoot,
            message: "Watched locations must stay inside the selected project folder.",
            recoverable: true,
        }
    }

    pub(crate) fn root_not_directory() -> Self {
        Self {
            code: CommandErrorCode::RootNotDirectory,
            message: "The selected project root is not a folder.",
            recoverable: true,
        }
    }

    pub(crate) fn root_not_found() -> Self {
        Self {
            code: CommandErrorCode::RootNotFound,
            message: "The selected project folder does not exist.",
            recoverable: true,
        }
    }

    pub(crate) fn watched_location_invalid(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::WatchedLocationInvalid,
            message,
            recoverable: true,
        }
    }

    pub(crate) fn storage_unavailable() -> Self {
        Self {
            code: CommandErrorCode::StorageUnavailable,
            message: "Local application data is unavailable.",
            recoverable: true,
        }
    }

    pub(crate) fn code(&self) -> &'static str {
        match self.code {
            CommandErrorCode::FilesystemUnavailable => "FILESYSTEM_UNAVAILABLE",
            CommandErrorCode::InvalidInput => "INVALID_INPUT",
            CommandErrorCode::NotFound => "NOT_FOUND",
            CommandErrorCode::PathOutsideRoot => "PATH_OUTSIDE_ROOT",
            CommandErrorCode::ProjectRootConflict => "PROJECT_ROOT_CONFLICT",
            CommandErrorCode::RootNotDirectory => "ROOT_NOT_DIRECTORY",
            CommandErrorCode::RootNotFound => "ROOT_NOT_FOUND",
            CommandErrorCode::StorageUnavailable => "STORAGE_UNAVAILABLE",
            CommandErrorCode::WatchedLocationInvalid => "WATCHED_LOCATION_INVALID",
        }
    }
}

impl From<AppError> for CommandError {
    fn from(error: AppError) -> Self {
        match error {
            AppError::InvalidInput(_) => Self::invalid_input("The request contains invalid data."),
            AppError::Database(_)
            | AppError::Migration(_)
            | AppError::Filesystem(_)
            | AppError::InvalidBackupPath
            | AppError::BackupVerification
            | AppError::InvalidPersistedData(_) => Self::storage_unavailable(),
        }
    }
}
