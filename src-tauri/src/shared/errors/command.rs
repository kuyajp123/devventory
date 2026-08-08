use serde::Serialize;

use super::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum CommandErrorCode {
    AgentUsageConflict,
    AssetConflict,
    EnvironmentConflict,
    FilesystemUnavailable,
    InvalidInput,
    ManifestConflict,
    ManifestPathInvalid,
    NotFound,
    OperationUnavailable,
    PathOutsideRoot,
    ProjectRootConflict,
    RootNotDirectory,
    RootNotFound,
    StorageUnavailable,
    WatchedLocationInvalid,
    VariantAlreadySelected,
    VariantCircular,
    VariantMissing,
    VariantNotIndexed,
    VariantPathOutsideRoot,
    VariantSelfReference,
    ValidationConflict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandError {
    code: CommandErrorCode,
    message: &'static str,
    recoverable: bool,
}

impl CommandError {
    pub(crate) fn agent_usage_conflict(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::AgentUsageConflict,
            message,
            recoverable: true,
        }
    }

    pub(crate) fn asset_conflict(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::AssetConflict,
            message,
            recoverable: true,
        }
    }

    pub(crate) fn environment_conflict(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::EnvironmentConflict,
            message,
            recoverable: true,
        }
    }

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

    pub(crate) fn manifest_conflict() -> Self {
        Self {
            code: CommandErrorCode::ManifestConflict,
            message: "A file already exists at that manifest destination.",
            recoverable: true,
        }
    }

    pub(crate) fn manifest_path_invalid() -> Self {
        Self {
            code: CommandErrorCode::ManifestPathInvalid,
            message: "The manifest destination must stay inside the project root and use existing folders.",
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

    pub(crate) fn operation_unavailable(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::OperationUnavailable,
            message,
            recoverable: true,
        }
    }

    pub(crate) fn validation_conflict(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::ValidationConflict,
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

    pub(crate) fn variant_already_selected() -> Self {
        Self {
            code: CommandErrorCode::VariantAlreadySelected,
            message: "That file is already selected as a variant.",
            recoverable: true,
        }
    }

    pub(crate) fn variant_circular() -> Self {
        Self {
            code: CommandErrorCode::VariantCircular,
            message: "That file would create a circular variant relationship.",
            recoverable: true,
        }
    }

    pub(crate) fn variant_missing() -> Self {
        Self {
            code: CommandErrorCode::VariantMissing,
            message: "That indexed file is currently missing or unavailable.",
            recoverable: true,
        }
    }

    pub(crate) fn variant_not_indexed() -> Self {
        Self {
            code: CommandErrorCode::VariantNotIndexed,
            message: "That project-relative file path is not indexed.",
            recoverable: true,
        }
    }

    pub(crate) fn variant_path_outside_root() -> Self {
        Self {
            code: CommandErrorCode::VariantPathOutsideRoot,
            message: "Variant paths must stay inside the current project root.",
            recoverable: true,
        }
    }

    pub(crate) fn variant_self_reference() -> Self {
        Self {
            code: CommandErrorCode::VariantSelfReference,
            message: "An asset cannot be a variant of itself.",
            recoverable: true,
        }
    }

    pub(crate) fn code(&self) -> &'static str {
        match self.code {
            CommandErrorCode::AgentUsageConflict => "AGENT_USAGE_CONFLICT",
            CommandErrorCode::AssetConflict => "ASSET_CONFLICT",
            CommandErrorCode::EnvironmentConflict => "ENVIRONMENT_CONFLICT",
            CommandErrorCode::FilesystemUnavailable => "FILESYSTEM_UNAVAILABLE",
            CommandErrorCode::InvalidInput => "INVALID_INPUT",
            CommandErrorCode::ManifestConflict => "MANIFEST_CONFLICT",
            CommandErrorCode::ManifestPathInvalid => "MANIFEST_PATH_INVALID",
            CommandErrorCode::NotFound => "NOT_FOUND",
            CommandErrorCode::OperationUnavailable => "OPERATION_UNAVAILABLE",
            CommandErrorCode::PathOutsideRoot => "PATH_OUTSIDE_ROOT",
            CommandErrorCode::ProjectRootConflict => "PROJECT_ROOT_CONFLICT",
            CommandErrorCode::RootNotDirectory => "ROOT_NOT_DIRECTORY",
            CommandErrorCode::RootNotFound => "ROOT_NOT_FOUND",
            CommandErrorCode::StorageUnavailable => "STORAGE_UNAVAILABLE",
            CommandErrorCode::WatchedLocationInvalid => "WATCHED_LOCATION_INVALID",
            CommandErrorCode::VariantAlreadySelected => "VARIANT_ALREADY_SELECTED",
            CommandErrorCode::VariantCircular => "VARIANT_CIRCULAR",
            CommandErrorCode::VariantMissing => "VARIANT_MISSING",
            CommandErrorCode::VariantNotIndexed => "VARIANT_NOT_INDEXED",
            CommandErrorCode::VariantPathOutsideRoot => "VARIANT_PATH_OUTSIDE_ROOT",
            CommandErrorCode::VariantSelfReference => "VARIANT_SELF_REFERENCE",
            CommandErrorCode::ValidationConflict => "VALIDATION_CONFLICT",
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
