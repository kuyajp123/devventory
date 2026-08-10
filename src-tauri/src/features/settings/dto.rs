use serde::{Deserialize, Serialize};

use super::model::{BackgroundStartupPreferences, NotificationPreferences};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotificationPreferencesDto {
    pub(crate) enabled: bool,
    pub(crate) in_app_enabled: bool,
    pub(crate) system_enabled: bool,
}

impl From<NotificationPreferences> for NotificationPreferencesDto {
    fn from(domain: NotificationPreferences) -> Self {
        Self {
            enabled: domain.enabled,
            in_app_enabled: domain.in_app_enabled,
            system_enabled: domain.system_enabled,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotificationPreferencesInput {
    pub(crate) enabled: bool,
    pub(crate) in_app_enabled: bool,
    pub(crate) system_enabled: bool,
}

impl From<NotificationPreferencesInput> for NotificationPreferences {
    fn from(input: NotificationPreferencesInput) -> Self {
        Self {
            enabled: input.enabled,
            in_app_enabled: input.in_app_enabled,
            system_enabled: input.system_enabled,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackgroundStartupPreferencesDto {
    pub(crate) keep_running_when_closed: bool,
    pub(crate) start_with_windows: bool,
}

impl From<BackgroundStartupPreferences> for BackgroundStartupPreferencesDto {
    fn from(domain: BackgroundStartupPreferences) -> Self {
        Self {
            keep_running_when_closed: domain.keep_running_when_closed,
            start_with_windows: domain.start_with_windows,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackgroundStartupPreferencesInput {
    pub(crate) keep_running_when_closed: bool,
    pub(crate) start_with_windows: bool,
}

impl From<BackgroundStartupPreferencesInput> for BackgroundStartupPreferences {
    fn from(input: BackgroundStartupPreferencesInput) -> Self {
        Self {
            keep_running_when_closed: input.keep_running_when_closed,
            start_with_windows: input.start_with_windows,
        }
    }
}
