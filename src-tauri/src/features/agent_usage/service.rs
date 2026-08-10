use std::collections::HashMap;

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use uuid::Uuid;

use super::{
    domain::{
        derive_account_status, derive_next_reset, derive_quota_status, derive_reset_timing,
        QuotaWindowState,
    },
    error::AgentUsageError,
    model::{
        AgentAccount, AgentQuotaWindow, SaveAgentAccount, SaveQuotaWindow, TrackingMode,
        TrackingSource,
    },
    repository::SqliteAgentUsageRepository,
};

const MAX_CUSTOM_PLATFORM_LENGTH: usize = 80;
const MAX_IDENTIFIER_LENGTH: usize = 320;
const MAX_QUOTA_LABEL_LENGTH: usize = 80;

#[derive(Debug, Clone)]
pub(crate) struct AgentUsageService {
    repository: SqliteAgentUsageRepository,
}

impl AgentUsageService {
    pub(crate) fn new(repository: SqliteAgentUsageRepository) -> Self {
        Self { repository }
    }

    pub(crate) async fn list_accounts(&self) -> Result<Vec<AgentAccount>, AgentUsageError> {
        let now = Utc::now();
        self.repository.mark_elapsed_resets(now).await?;
        let mut quotas_by_account = self.repository.list_all_quotas().await?.into_iter().fold(
            HashMap::new(),
            |mut grouped, quota| {
                grouped
                    .entry(quota.account_id)
                    .or_insert_with(Vec::new)
                    .push(quota);
                grouped
            },
        );
        let mut accounts = Vec::new();
        for account in self.repository.list_accounts().await? {
            let stored_quotas = quotas_by_account.remove(&account.id).unwrap_or_default();
            let states = stored_quotas.iter().map(quota_state).collect::<Vec<_>>();
            let availability = derive_account_status(&states, now);
            let next_reset_at = derive_next_reset(&states, now);
            let quotas = stored_quotas
                .into_iter()
                .zip(states)
                .map(|(stored, state)| quota_window(stored, &state, now))
                .collect::<Result<Vec<_>, _>>()?;
            accounts.push(AgentAccount {
                stored: account,
                availability,
                next_reset_at,
                quotas,
            });
        }
        Ok(accounts)
    }

    pub(crate) async fn save_account(
        &self,
        mut input: SaveAgentAccount,
    ) -> Result<AgentAccount, AgentUsageError> {
        validate_account(&mut input)?;
        let account = self.repository.save_account(input).await?;
        self.list_accounts()
            .await?
            .into_iter()
            .find(|candidate| candidate.stored.id == account.id)
            .ok_or(AgentUsageError::NotFound)
    }

    pub(crate) async fn delete_account(&self, id: Uuid) -> Result<(), AgentUsageError> {
        self.repository.delete_account(id).await
    }

    pub(crate) async fn save_quota(
        &self,
        mut input: SaveQuotaWindow,
    ) -> Result<AgentQuotaWindow, AgentUsageError> {
        validate_quota(&mut input)?;
        let quota = self.repository.save_quota(input).await?;
        self.repository.mark_elapsed_resets(Utc::now()).await?;
        let quota = self
            .repository
            .list_quotas(quota.account_id)
            .await?
            .into_iter()
            .find(|candidate| candidate.id == quota.id)
            .ok_or(AgentUsageError::NotFound)?;
        let now = Utc::now();
        let state = quota_state(&quota);
        quota_window(quota, &state, now)
    }

    pub(crate) async fn delete_quota(
        &self,
        account_id: Uuid,
        id: Uuid,
    ) -> Result<(), AgentUsageError> {
        self.repository.delete_quota(account_id, id).await
    }

    pub(crate) async fn claim_due_reminders(
        &self,
        lease_duration: chrono::Duration,
    ) -> Result<super::model::ReminderBatch, AgentUsageError> {
        self.repository
            .claim_due_reminders(Utc::now(), lease_duration)
            .await
    }

    pub(crate) async fn acknowledge_reminders(
        &self,
        batch_token: Uuid,
        outcomes: Vec<super::model::ReminderOutcome>,
    ) -> Result<(), AgentUsageError> {
        self.repository
            .acknowledge_reminders(batch_token, outcomes, Utc::now())
            .await
    }
}

fn validate_account(input: &mut SaveAgentAccount) -> Result<(), AgentUsageError> {
    input.identifier = input.identifier.trim().to_owned();
    if input.identifier.is_empty() || input.identifier.chars().count() > MAX_IDENTIFIER_LENGTH {
        return Err(AgentUsageError::InvalidInput);
    }
    input.custom_platform = input
        .custom_platform
        .take()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if input.platform == super::model::AgentPlatform::Custom {
        let Some(custom) = input.custom_platform.as_ref() else {
            return Err(AgentUsageError::InvalidInput);
        };
        if custom.chars().count() > MAX_CUSTOM_PLATFORM_LENGTH {
            return Err(AgentUsageError::InvalidInput);
        }
    } else if input.custom_platform.is_some() {
        return Err(AgentUsageError::InvalidInput);
    }
    validate_timezone(&input.default_timezone)?;
    if input.tracking_mode != TrackingMode::Manual {
        return Err(AgentUsageError::InvalidInput);
    }
    Ok(())
}

fn validate_quota(input: &mut SaveQuotaWindow) -> Result<(), AgentUsageError> {
    input.label = input.label.trim().to_owned();
    if input.label.is_empty() || input.label.chars().count() > MAX_QUOTA_LABEL_LENGTH {
        return Err(AgentUsageError::InvalidInput);
    }
    if input
        .remaining_percent
        .is_some_and(|value| !value.is_finite() || !(0.0..=100.0).contains(&value))
    {
        return Err(AgentUsageError::InvalidInput);
    }
    validate_timezone(&input.timezone)?;
    if input.tracking_source == TrackingSource::AutomaticConnector {
        return Err(AgentUsageError::InvalidInput);
    }
    Ok(())
}

fn validate_timezone(value: &str) -> Result<Tz, AgentUsageError> {
    value
        .parse::<Tz>()
        .map_err(|_| AgentUsageError::InvalidInput)
}

fn quota_state(quota: &super::model::StoredQuotaWindow) -> QuotaWindowState {
    QuotaWindowState {
        id: quota.id,
        remaining_percent: quota.remaining_percent,
        reset_at: quota.reset_at,
        reset_reached_at: quota.reset_reached_at,
        usage_is_stale: quota.usage_is_stale,
    }
}

fn quota_window(
    stored: super::model::StoredQuotaWindow,
    state: &QuotaWindowState,
    now: DateTime<Utc>,
) -> Result<AgentQuotaWindow, AgentUsageError> {
    let timezone = stored
        .timezone
        .parse::<Tz>()
        .map_err(|_| AgentUsageError::InvalidPersistedData)?;
    Ok(AgentQuotaWindow {
        status: derive_quota_status(state, now),
        reset_timing: derive_reset_timing(stored.reset_at, timezone, now),
        stored,
    })
}
