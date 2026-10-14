use zeroize::Zeroizing;

pub(crate) trait Credentials: Send + Sync {
    fn save(&self, identity: &str, token: &str) -> Result<(), ()>;
    fn load(&self, identity: &str) -> Result<Zeroizing<String>, ()>;
}
pub(crate) struct NativeCredentials;
impl Credentials for NativeCredentials {
    fn save(&self, identity: &str, token: &str) -> Result<(), ()> {
        #[cfg(not(windows))]
        {
            let _ = (identity, token);
            Err(())
        }
        #[cfg(windows)]
        keyring::Entry::new("com.paul.devventory.cloud-sync", identity)
            .map_err(|_| ())?
            .set_password(token)
            .map_err(|_| ())
    }
    fn load(&self, identity: &str) -> Result<Zeroizing<String>, ()> {
        #[cfg(not(windows))]
        {
            let _ = identity;
            Err(())
        }
        #[cfg(windows)]
        keyring::Entry::new("com.paul.devventory.cloud-sync", identity)
            .map_err(|_| ())?
            .get_password()
            .map(Zeroizing::new)
            .map_err(|_| ())
    }
}
