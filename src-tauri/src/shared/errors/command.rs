use serde::Serialize;

use super::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum CommandErrorCode {
    AuthInvalidCredentials,
    AuthInvalidInput,
    AuthConfiguration,
    AuthOffline,
    AuthRateLimited,
    AuthSessionExpired,
    AuthVerificationRequired,
    AuthAccountMismatch,
    AuthCredentialUnavailable,
    AuthInvalidResponse,
    AuthPublisherExists,
    AuthLegacyClaimRequired,
    CloudSyncConfigurationInvalid,
    CloudSyncCredentialsUnavailable,
    CloudSyncConnectionUnavailable,
    AgentUsageConflict,
    AssetConflict,
    CredentialVaultPasswordIncorrect,
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
    pub(crate) fn authentication(code: &str) -> Self {
        let (code, message) = match code {
            "AUTH_INVALID_CREDENTIALS" => (CommandErrorCode::AuthInvalidCredentials, "Email or password is incorrect."),
            "AUTH_INVALID_INPUT" => (CommandErrorCode::AuthInvalidInput, "Check the email address and password requirements."),
            "AUTH_CONFIGURATION" => (CommandErrorCode::AuthConfiguration, "Authentication is not configured. Check the Firebase setup."),
            "AUTH_OFFLINE" => (CommandErrorCode::AuthOffline, "Authentication is unreachable. Check your connection and retry."),
            "AUTH_RATE_LIMITED" => (CommandErrorCode::AuthRateLimited, "Too many requests. Wait before retrying."),
            "AUTH_SESSION_EXPIRED" => (CommandErrorCode::AuthSessionExpired, "Sign in again to continue."),
            "AUTH_VERIFICATION_REQUIRED" => (CommandErrorCode::AuthVerificationRequired, "Verify your email before using Cloud Sync."),
            "AUTH_ACCOUNT_MISMATCH" => (CommandErrorCode::AuthAccountMismatch, "This local database is linked to a different cloud account. Review the account change before linking it."),
            "AUTH_CREDENTIAL_UNAVAILABLE" => (CommandErrorCode::AuthCredentialUnavailable, "The session could not be stored securely in Windows Credential Manager."),
            "PUBLISHER_ALREADY_REGISTERED" => (CommandErrorCode::AuthPublisherExists, "Another publishing desktop is registered. Confirm replacement before using this computer."),
            "LEGACY_CLAIM_REQUIRED" => (CommandErrorCode::AuthLegacyClaimRequired, "Confirm the protected claim of your existing cloud workspace."),
            _ => (CommandErrorCode::AuthInvalidResponse, "The authentication service returned an invalid response. Try again."),
        };
        Self {
            code,
            message,
            recoverable: true,
        }
    }
    pub(crate) fn cloud_sync_configuration_invalid() -> Self {
        Self {
            code: CommandErrorCode::CloudSyncConfigurationInvalid,
            message: "Check the Worker URL, workspace ID, device ID, and publisher token.",
            recoverable: true,
        }
    }
    pub(crate) fn cloud_sync_credentials_unavailable() -> Self {
        Self {
            code: CommandErrorCode::CloudSyncCredentialsUnavailable,
            message:
                "The publisher token could not be saved or read in Windows Credential Manager.",
            recoverable: true,
        }
    }
    pub(crate) fn cloud_sync_connection_unavailable() -> Self {
        Self{code:CommandErrorCode::CloudSyncConnectionUnavailable,message:"The cloud operation could not be completed. Check the connection and Cloud Sync status.",recoverable:true}
    }
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

    pub(crate) fn credential_vault_password_incorrect(message: &'static str) -> Self {
        Self {
            code: CommandErrorCode::CredentialVaultPasswordIncorrect,
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
            CommandErrorCode::AuthInvalidCredentials => "AUTH_INVALID_CREDENTIALS",
            CommandErrorCode::AuthInvalidInput => "AUTH_INVALID_INPUT",
            CommandErrorCode::AuthConfiguration => "AUTH_CONFIGURATION",
            CommandErrorCode::AuthOffline => "AUTH_OFFLINE",
            CommandErrorCode::AuthRateLimited => "AUTH_RATE_LIMITED",
            CommandErrorCode::AuthSessionExpired => "AUTH_SESSION_EXPIRED",
            CommandErrorCode::AuthVerificationRequired => "AUTH_VERIFICATION_REQUIRED",
            CommandErrorCode::AuthAccountMismatch => "AUTH_ACCOUNT_MISMATCH",
            CommandErrorCode::AuthCredentialUnavailable => "AUTH_CREDENTIAL_UNAVAILABLE",
            CommandErrorCode::AuthInvalidResponse => "AUTH_INVALID_RESPONSE",
            CommandErrorCode::AuthPublisherExists => "AUTH_PUBLISHER_EXISTS",
            CommandErrorCode::AuthLegacyClaimRequired => "AUTH_LEGACY_CLAIM_REQUIRED",
            CommandErrorCode::CloudSyncConfigurationInvalid => "CLOUD_SYNC_CONFIGURATION_INVALID",
            CommandErrorCode::CloudSyncCredentialsUnavailable => {
                "CLOUD_SYNC_CREDENTIALS_UNAVAILABLE"
            }
            CommandErrorCode::CloudSyncConnectionUnavailable => "CLOUD_SYNC_CONNECTION_UNAVAILABLE",
            CommandErrorCode::AgentUsageConflict => "AGENT_USAGE_CONFLICT",
            CommandErrorCode::AssetConflict => "ASSET_CONFLICT",
            CommandErrorCode::CredentialVaultPasswordIncorrect => {
                "CREDENTIAL_VAULT_PASSWORD_INCORRECT"
            }
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
