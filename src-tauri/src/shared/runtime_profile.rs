//! Native storage identities must match the application's runtime profile.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RuntimeProfile {
    Development,
    Installed,
}

impl RuntimeProfile {
    pub(crate) fn current() -> Self {
        if tauri::is_dev() {
            Self::Development
        } else {
            Self::Installed
        }
    }

    pub(crate) fn identifier(self) -> &'static str {
        match self {
            Self::Development => "com.paul.devventory.dev",
            Self::Installed => "com.paul.devventory",
        }
    }

    pub(crate) fn credential_service(self, feature: &str) -> String {
        format!("{}.{feature}", self.identifier())
    }
}

#[cfg(test)]
mod tests {
    use super::RuntimeProfile;

    #[test]
    fn development_native_credentials_cannot_read_or_replace_installed_credentials() {
        for feature in ["authentication", "cloud-sync"] {
            assert_ne!(
                RuntimeProfile::Development.credential_service(feature),
                RuntimeProfile::Installed.credential_service(feature)
            );
            assert_eq!(
                RuntimeProfile::Development.credential_service(feature),
                format!("com.paul.devventory.dev.{feature}")
            );
        }
    }

    #[test]
    fn installed_credential_service_names_remain_backward_compatible() {
        assert_eq!(
            RuntimeProfile::Installed.credential_service("authentication"),
            "com.paul.devventory.authentication"
        );
        assert_eq!(
            RuntimeProfile::Installed.credential_service("cloud-sync"),
            "com.paul.devventory.cloud-sync"
        );
    }

    #[test]
    fn runtime_mode_not_optimization_level_selects_the_profile() {
        assert_eq!(
            RuntimeProfile::current() == RuntimeProfile::Development,
            tauri::is_dev()
        );
    }
}
