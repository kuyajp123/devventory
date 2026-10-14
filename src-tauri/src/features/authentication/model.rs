use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, Zeroizing};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Account {
    pub(crate) user_id: String,
    pub(crate) email: String,
    pub(crate) email_verified: bool,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AuthSession {
    pub(crate) configured: bool,
    pub(crate) state: String,
    pub(crate) account: Option<Account>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SavedSession {
    pub(crate) account: Account,
    pub(crate) refresh_token: String,
}
impl Drop for SavedSession {
    fn drop(&mut self) {
        self.refresh_token.zeroize();
    }
}
pub(crate) struct Login {
    pub(crate) account: Account,
    pub(crate) refresh_token: Zeroizing<String>,
    pub(crate) id_token: Zeroizing<String>,
    pub(crate) expires_at: i64,
}
pub(crate) struct Authorization {
    pub(crate) token: Zeroizing<String>,
    pub(crate) generation: u64,
}
#[derive(Debug, thiserror::Error)]
pub(crate) enum AuthError {
    #[error("Email or password is incorrect")]
    InvalidCredentials,
    #[error("Check the email address and password requirements")]
    InvalidInput,
    #[error("Authentication configuration is unavailable")]
    Configuration,
    #[error("Authentication is temporarily unreachable")]
    Offline,
    #[error("Too many requests. Wait before retrying")]
    RateLimited,
    #[error("Sign in again to continue")]
    SessionExpired,
    #[error("Verify your email before using Cloud Sync")]
    VerificationRequired,
    #[error("This local database is linked to a different cloud account")]
    AccountMismatch,
    #[error("The session could not be stored securely")]
    CredentialUnavailable,
    #[error("The authentication response is invalid")]
    InvalidResponse,
}
impl AuthError {
    pub(crate) fn code(&self) -> &'static str {
        match self {
            Self::InvalidCredentials => "AUTH_INVALID_CREDENTIALS",
            Self::InvalidInput => "AUTH_INVALID_INPUT",
            Self::Configuration => "AUTH_CONFIGURATION",
            Self::Offline => "AUTH_OFFLINE",
            Self::RateLimited => "AUTH_RATE_LIMITED",
            Self::SessionExpired => "AUTH_SESSION_EXPIRED",
            Self::VerificationRequired => "AUTH_VERIFICATION_REQUIRED",
            Self::AccountMismatch => "AUTH_ACCOUNT_MISMATCH",
            Self::CredentialUnavailable => "AUTH_CREDENTIAL_UNAVAILABLE",
            Self::InvalidResponse => "AUTH_INVALID_RESPONSE",
        }
    }
}
