#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NotificationPreferences {
    pub(crate) enabled: bool,
    pub(crate) in_app_enabled: bool,
    pub(crate) system_enabled: bool,
}

impl Default for NotificationPreferences {
    fn default() -> Self {
        Self {
            enabled: true,
            in_app_enabled: true,
            system_enabled: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BackgroundStartupPreferences {
    pub(crate) keep_running_when_closed: bool,
    pub(crate) start_with_windows: bool,
}

impl Default for BackgroundStartupPreferences {
    fn default() -> Self {
        Self {
            keep_running_when_closed: true,
            start_with_windows: false,
        }
    }
}
