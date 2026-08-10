use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use super::{
    domain::{AgentAvailability, ResetTiming},
    error::AgentUsageError,
};

macro_rules! string_enum {
    ($name:ident, $serialization_case:literal { $($variant:ident => $value:literal),+ $(,)? }) => {
        #[allow(dead_code)]
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
        #[serde(rename_all = $serialization_case)]
        pub(crate) enum $name { $($variant),+ }

        impl $name {
            #[allow(dead_code)]
            pub(crate) const fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
        }

        impl TryFrom<&str> for $name {
            type Error = AgentUsageError;

            fn try_from(value: &str) -> Result<Self, Self::Error> {
                match value {
                    $($value => Ok(Self::$variant),)+
                    _ => Err(AgentUsageError::InvalidPersistedData),
                }
            }
        }
    };
}

string_enum!(AgentPlatform, "snake_case" {
    Codex => "codex",
    ClaudeCode => "claude_code",
    Devin => "devin",
    GithubCopilot => "github_copilot",
    Cursor => "cursor",
    Kiro => "kiro",
    Antigravity => "antigravity",
    GeminiCli => "gemini_cli",
    Windsurf => "windsurf",
    Custom => "custom",
});

string_enum!(SignInMethod, "snake_case" {
    Google => "google",
    Github => "github",
    Microsoft => "microsoft",
    Apple => "apple",
    Email => "email",
    Phone => "phone",
    OrganizationSso => "organization_sso",
    Other => "other",
});

string_enum!(TrackingMode, "camelCase" {
    Manual => "manual",
    AutomaticConnector => "automatic_connector",
});

string_enum!(TrackingSource, "camelCase" {
    Manual => "manual",
    Pasted => "pasted",
    AutomaticConnector => "automatic_connector",
});

string_enum!(ReminderKind, "camelCase" {
    BeforeReset => "before_reset",
    ResetDay => "reset_day",
    ResetReached => "reset_reached",
});

string_enum!(ReminderStatus, "camelCase" {
    Pending => "pending",
    Claimed => "claimed",
    Delivered => "delivered",
    Skipped => "skipped",
});

string_enum!(SkipReason, "camelCase" {
    Stale => "stale",
    IntentionallySuppressed => "intentionally_suppressed",
});

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ReminderOutcome {
    Delivered { id: Uuid },
    Suppressed { id: Uuid },
    Failed { id: Uuid },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReminderBatch {
    pub(crate) batch_token: Uuid,
    pub(crate) reminders: Vec<AgentReminder>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReminderPreferences {
    pub(crate) before_reset_hours: Option<u32>,
    pub(crate) reset_day: bool,
    pub(crate) reset_reached: bool,
}

impl ReminderPreferences {
    #[cfg(test)]
    pub(crate) const fn all() -> Self {
        Self {
            before_reset_hours: Some(24),
            reset_day: true,
            reset_reached: true,
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct SaveAgentAccount {
    pub(crate) id: Option<Uuid>,
    pub(crate) platform: AgentPlatform,
    pub(crate) custom_platform: Option<String>,
    pub(crate) sign_in_method: SignInMethod,
    pub(crate) identifier: String,
    pub(crate) tracking_mode: TrackingMode,
    pub(crate) default_timezone: String,
}

#[derive(Debug, Clone)]
pub(crate) struct SaveQuotaWindow {
    pub(crate) id: Option<Uuid>,
    pub(crate) account_id: Uuid,
    pub(crate) label: String,
    pub(crate) remaining_percent: Option<f64>,
    pub(crate) reset_at: DateTime<Utc>,
    pub(crate) timezone: String,
    pub(crate) tracking_source: TrackingSource,
    pub(crate) reminders: ReminderPreferences,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredAgentAccount {
    pub(crate) id: Uuid,
    pub(crate) platform: AgentPlatform,
    pub(crate) custom_platform: Option<String>,
    pub(crate) sign_in_method: SignInMethod,
    pub(crate) identifier: String,
    pub(crate) tracking_mode: TrackingMode,
    pub(crate) default_timezone: String,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredQuotaWindow {
    pub(crate) id: Uuid,
    pub(crate) account_id: Uuid,
    pub(crate) label: String,
    pub(crate) remaining_percent: Option<f64>,
    pub(crate) reset_at: DateTime<Utc>,
    pub(crate) timezone: String,
    pub(crate) tracking_source: TrackingSource,
    pub(crate) usage_updated_at: Option<DateTime<Utc>>,
    pub(crate) usage_is_stale: bool,
    pub(crate) reset_reached_at: Option<DateTime<Utc>>,
    pub(crate) reminders: ReminderPreferences,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentQuotaWindow {
    #[serde(flatten)]
    pub(crate) stored: StoredQuotaWindow,
    pub(crate) status: AgentAvailability,
    pub(crate) reset_timing: ResetTiming,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentAccount {
    #[serde(flatten)]
    pub(crate) stored: StoredAgentAccount,
    pub(crate) availability: AgentAvailability,
    pub(crate) next_reset_at: Option<DateTime<Utc>>,
    pub(crate) quotas: Vec<AgentQuotaWindow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentReminder {
    pub(crate) id: Uuid,
    pub(crate) account_id: Uuid,
    pub(crate) quota_window_id: Uuid,
    pub(crate) kind: ReminderKind,
    pub(crate) platform: AgentPlatform,
    pub(crate) custom_platform: Option<String>,
    pub(crate) identifier: String,
    pub(crate) quota_label: String,
    pub(crate) reset_at: DateTime<Utc>,
    pub(crate) scheduled_for: DateTime<Utc>,
}
