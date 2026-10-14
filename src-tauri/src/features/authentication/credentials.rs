use super::AuthError;
use zeroize::Zeroizing;
pub(crate) trait SessionStore: Send + Sync {
    fn load(&self) -> Result<Option<Zeroizing<String>>, AuthError>;
    fn save(&self, value: &str) -> Result<(), AuthError>;
    fn delete(&self) -> Result<(), AuthError>;
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
    fn delete(&self) -> Result<(), AuthError> {
        #[cfg(windows)]
        {
            match self.entry()?.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(_) => Err(AuthError::CredentialUnavailable),
            }
        }
        #[cfg(not(windows))]
        {
            Err(AuthError::CredentialUnavailable)
        }
    }
}
