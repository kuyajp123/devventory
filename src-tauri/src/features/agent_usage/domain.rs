use chrono::{DateTime, Duration, Utc};
use chrono_tz::Tz;
use serde::Serialize;
use uuid::Uuid;

const LIMITED_REMAINING_PERCENT: f64 = 20.0;
const RESET_SOON_HOURS: i64 = 24;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentAvailability {
    Available,
    Limited,
    Exhausted,
    ResetSoon,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ResetTiming {
    Today,
    Tomorrow,
    Future,
    Elapsed,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct QuotaWindowState {
    pub(crate) id: Uuid,
    pub(crate) remaining_percent: Option<f64>,
    pub(crate) reset_at: DateTime<Utc>,
    pub(crate) reset_reached_at: Option<DateTime<Utc>>,
    pub(crate) usage_is_stale: bool,
}

#[cfg(test)]
pub(crate) fn apply_elapsed_reset(quota: &mut QuotaWindowState, now: DateTime<Utc>) -> bool {
    if quota.reset_at > now || quota.reset_reached_at == Some(quota.reset_at) {
        return false;
    }

    quota.remaining_percent = None;
    quota.usage_is_stale = true;
    quota.reset_reached_at = Some(quota.reset_at);
    true
}

pub(crate) fn derive_quota_status(
    quota: &QuotaWindowState,
    now: DateTime<Utc>,
) -> AgentAvailability {
    if quota.reset_reached_at == Some(quota.reset_at) || quota.reset_at <= now {
        return AgentAvailability::Available;
    }

    match quota.remaining_percent {
        Some(value) if value <= 0.0 => AgentAvailability::Exhausted,
        Some(value) if value <= LIMITED_REMAINING_PERCENT => AgentAvailability::Limited,
        _ if quota.reset_at - now <= Duration::hours(RESET_SOON_HOURS) => {
            AgentAvailability::ResetSoon
        }
        Some(_) => AgentAvailability::Available,
        None => AgentAvailability::Unknown,
    }
}

pub(crate) fn derive_account_status(
    quotas: &[QuotaWindowState],
    now: DateTime<Utc>,
) -> AgentAvailability {
    if quotas.is_empty() {
        return AgentAvailability::Unknown;
    }

    let statuses = quotas
        .iter()
        .map(|quota| derive_quota_status(quota, now))
        .collect::<Vec<_>>();

    for status in [
        AgentAvailability::Exhausted,
        AgentAvailability::Limited,
        AgentAvailability::Unknown,
        AgentAvailability::ResetSoon,
    ] {
        if statuses.contains(&status) {
            return status;
        }
    }

    AgentAvailability::Available
}

pub(crate) fn derive_next_reset(
    quotas: &[QuotaWindowState],
    now: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    quotas
        .iter()
        .filter(|quota| quota.reset_reached_at != Some(quota.reset_at))
        .map(|quota| quota.reset_at)
        .filter(|reset_at| *reset_at > now)
        .min()
}

pub(crate) fn derive_reset_timing(
    reset_at: DateTime<Utc>,
    timezone: Tz,
    now: DateTime<Utc>,
) -> ResetTiming {
    if reset_at <= now {
        return ResetTiming::Elapsed;
    }

    let today = now.with_timezone(&timezone).date_naive();
    match reset_at.with_timezone(&timezone).date_naive() - today {
        difference if difference.num_days() == 0 => ResetTiming::Today,
        difference if difference.num_days() == 1 => ResetTiming::Tomorrow,
        _ => ResetTiming::Future,
    }
}
