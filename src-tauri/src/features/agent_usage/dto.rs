use chrono::{DateTime, Utc};
use serde::Deserialize;
use uuid::Uuid;

use super::{
    error::AgentUsageError,
    model::{
        AgentPlatform, ReminderPreferences, SaveAgentAccount, SaveQuotaWindow, SignInMethod,
        TrackingMode, TrackingSource,
    },
    reset_parser::{parse_pasted_reset, preview_exact_reset, preview_relative_reset, ResetPreview},
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AgentAccountInput {
    id: Option<String>,
    platform: String,
    custom_platform: Option<String>,
    sign_in_method: String,
    identifier: String,
    tracking_mode: String,
    default_timezone: String,
}

impl TryFrom<AgentAccountInput> for SaveAgentAccount {
    type Error = AgentUsageError;

    fn try_from(value: AgentAccountInput) -> Result<Self, Self::Error> {
        Ok(Self {
            id: value.id.as_deref().map(parse_uuid).transpose()?,
            platform: AgentPlatform::try_from(value.platform.as_str())
                .map_err(|_| AgentUsageError::InvalidInput)?,
            custom_platform: value.custom_platform,
            sign_in_method: SignInMethod::try_from(value.sign_in_method.as_str())
                .map_err(|_| AgentUsageError::InvalidInput)?,
            identifier: value.identifier,
            tracking_mode: TrackingMode::try_from(value.tracking_mode.as_str())
                .map_err(|_| AgentUsageError::InvalidInput)?,
            default_timezone: value.default_timezone,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AgentRecordIdInput {
    id: String,
}

impl AgentRecordIdInput {
    pub(crate) fn id(&self) -> Result<Uuid, AgentUsageError> {
        parse_uuid(&self.id)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AgentQuotaInput {
    id: Option<String>,
    account_id: String,
    label: String,
    remaining_percent: Option<f64>,
    reset_at: String,
    timezone: String,
    tracking_source: String,
    reminders: ReminderPreferencesInput,
}

impl TryFrom<AgentQuotaInput> for SaveQuotaWindow {
    type Error = AgentUsageError;

    fn try_from(value: AgentQuotaInput) -> Result<Self, Self::Error> {
        Ok(Self {
            id: value.id.as_deref().map(parse_uuid).transpose()?,
            account_id: parse_uuid(&value.account_id)?,
            label: value.label,
            remaining_percent: value.remaining_percent,
            reset_at: parse_timestamp(&value.reset_at)?,
            timezone: value.timezone,
            tracking_source: TrackingSource::try_from(value.tracking_source.as_str())
                .map_err(|_| AgentUsageError::InvalidInput)?,
            reminders: value.reminders.into(),
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReminderPreferencesInput {
    one_day_before: bool,
    reset_day: bool,
    reset_reached: bool,
}

impl From<ReminderPreferencesInput> for ReminderPreferences {
    fn from(value: ReminderPreferencesInput) -> Self {
        Self {
            one_day_before: value.one_day_before,
            reset_day: value.reset_day,
            reset_reached: value.reset_reached,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AgentQuotaIdInput {
    account_id: String,
    quota_id: String,
}

impl AgentQuotaIdInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid), AgentUsageError> {
        Ok((parse_uuid(&self.account_id)?, parse_uuid(&self.quota_id)?))
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "method", rename_all = "camelCase", deny_unknown_fields)]
pub(crate) enum ResetPreviewInput {
    Exact {
        date: String,
        time: String,
        timezone: String,
    },
    Relative {
        days: u32,
        hours: u32,
        minutes: u32,
        timezone: String,
    },
    Pasted {
        text: String,
        timezone: String,
    },
}

impl ResetPreviewInput {
    pub(crate) fn preview(self) -> Result<ResetPreview, AgentUsageError> {
        match self {
            Self::Exact {
                date,
                time,
                timezone,
            } => preview_exact_reset(&date, &time, &timezone),
            Self::Relative {
                days,
                hours,
                minutes,
                timezone,
            } => preview_relative_reset(Utc::now(), days, hours, minutes, &timezone),
            Self::Pasted { text, timezone } => parse_pasted_reset(&text, &timezone, Utc::now()),
        }
        .map_err(|_| AgentUsageError::InvalidInput)
    }
}

fn parse_uuid(value: &str) -> Result<Uuid, AgentUsageError> {
    Uuid::parse_str(value).map_err(|_| AgentUsageError::InvalidInput)
}

fn parse_timestamp(value: &str) -> Result<DateTime<Utc>, AgentUsageError> {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| AgentUsageError::InvalidInput)
}
