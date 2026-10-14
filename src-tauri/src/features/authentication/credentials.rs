use super::AuthError;
use zeroize::Zeroizing;
// Retains no identity or credential. Its presence prevents a restarted app
// from interpreting sign-out as a never-configured legacy publisher.
pub(super) const SIGNED_OUT_MARKER: &str = r#"{"signedOut":true}"#;
pub(crate) trait SessionStore: Send + Sync {
    fn load(&self) -> Result<Option<Zeroizing<String>>, AuthError>;
    fn save(&self, value: &str) -> Result<(), AuthError>;
    fn clear(&self) -> Result<(), AuthError>;
}
pub(crate) struct NativeSessionStore {
    pub(crate) identity: String,
}
impl NativeSessionStore {
    #[cfg(windows)]
    fn entry(&self) -> Result<keyring::Entry, AuthError> {
        keyring::Entry::new("com.paul.devventory.authentication", &self.identity)
            .map_err(|_| AuthError::CredentialUnavailable)
    }
}
impl SessionStore for NativeSessionStore {
    fn load(&self) -> Result<Option<Zeroizing<String>>, AuthError> {
        #[cfg(windows)]
        {
            match self.entry()?.get_password() {
                Ok(value) => Ok(Some(Zeroizing::new(value))),
                Err(keyring::Error::NoEntry) => Ok(None),
                Err(_) => Err(AuthError::CredentialUnavailable),
            }
        }
        #[cfg(not(windows))]
        {
            let _ = &self.identity;
            Err(AuthError::CredentialUnavailable)
        }
    }
    fn save(&self, value: &str) -> Result<(), AuthError> {
        #[cfg(windows)]
        {
            self.entry()?
                .set_password(value)
                .map_err(|_| AuthError::CredentialUnavailable)
        }
        #[cfg(not(windows))]
        {
            let _ = value;
            Err(AuthError::CredentialUnavailable)
        }
    }
    fn clear(&self) -> Result<(), AuthError> {
        // Replace atomically in the native store rather than deleting first.
        // A failed write is reported; it must not claim the session was cleared.
        self.save(SIGNED_OUT_MARKER)
    }
}
