use std::collections::HashSet;

use chrono::{DateTime, Duration, LocalResult, TimeZone, Utc};
use chrono_tz::Tz;
use sqlx::{FromRow, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use super::{
    error::AgentUsageError,
    model::{
        AgentPlatform, AgentReminder, ReminderKind, ReminderPreferences, SaveAgentAccount,
        SaveQuotaWindow, SignInMethod, StoredAgentAccount, StoredQuotaWindow, TrackingMode,
        TrackingSource,
    },
};

#[derive(Debug, Clone)]
pub(crate) struct SqliteAgentUsageRepository {
    pool: SqlitePool,
}

impl SqliteAgentUsageRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub(crate) async fn list_accounts(&self) -> Result<Vec<StoredAgentAccount>, AgentUsageError> {
        sqlx::query_as::<_, AccountRow>(
            "SELECT id, platform, custom_platform, sign_in_method, identifier, tracking_mode,
                    default_timezone, created_at, updated_at
             FROM agent_accounts
             ORDER BY lower(platform), lower(identifier), id",
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn save_account(
        &self,
        input: SaveAgentAccount,
    ) -> Result<StoredAgentAccount, AgentUsageError> {
        let id = input.id.unwrap_or_else(Uuid::new_v4);
        let normalized_identifier = normalize(&input.identifier);
        let normalized_custom_platform = input
            .custom_platform
            .as_deref()
            .map(normalize)
            .unwrap_or_default();
        let result = if input.id.is_some() {
            sqlx::query(
                "UPDATE agent_accounts
                 SET platform = ?, custom_platform = ?, normalized_custom_platform = ?,
                     sign_in_method = ?, identifier = ?, normalized_identifier = ?,
                     tracking_mode = ?, default_timezone = ?,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?",
            )
            .bind(input.platform.as_str())
            .bind(input.custom_platform.as_deref())
            .bind(normalized_custom_platform)
            .bind(input.sign_in_method.as_str())
            .bind(input.identifier.trim())
            .bind(normalized_identifier)
            .bind(input.tracking_mode.as_str())
            .bind(&input.default_timezone)
            .bind(id.to_string())
            .execute(&self.pool)
            .await
        } else {
            sqlx::query(
                "INSERT INTO agent_accounts (
                    id, platform, custom_platform, normalized_custom_platform, sign_in_method,
                    identifier, normalized_identifier, tracking_mode, default_timezone
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(id.to_string())
            .bind(input.platform.as_str())
            .bind(input.custom_platform.as_deref())
            .bind(normalized_custom_platform)
            .bind(input.sign_in_method.as_str())
            .bind(input.identifier.trim())
            .bind(normalized_identifier)
            .bind(input.tracking_mode.as_str())
            .bind(&input.default_timezone)
            .execute(&self.pool)
            .await
        };

        match result {
            Ok(result) if input.id.is_some() && result.rows_affected() == 0 => {
                Err(AgentUsageError::NotFound)
            }
            Ok(_) => self.account(id).await,
            Err(error) if is_unique_violation(&error) => Err(AgentUsageError::DuplicateAccount),
            Err(error) => Err(error.into()),
        }
    }

    pub(crate) async fn delete_account(&self, id: Uuid) -> Result<(), AgentUsageError> {
        let result = sqlx::query("DELETE FROM agent_accounts WHERE id = ?")
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(AgentUsageError::NotFound);
        }
        Ok(())
    }

    pub(crate) async fn list_quotas(
        &self,
        account_id: Uuid,
    ) -> Result<Vec<StoredQuotaWindow>, AgentUsageError> {
        sqlx::query_as::<_, QuotaRow>(
            "SELECT id, account_id, label, remaining_percent, reset_at, timezone,
                    tracking_source, usage_updated_at, usage_is_stale, reset_reached_at,
                    before_reset_hours, remind_reset_day, remind_reset_reached, created_at, updated_at
             FROM agent_quota_windows WHERE account_id = ?
             ORDER BY reset_at, lower(label), id",
        )
        .bind(account_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn list_all_quotas(&self) -> Result<Vec<StoredQuotaWindow>, AgentUsageError> {
        sqlx::query_as::<_, QuotaRow>(
            "SELECT id, account_id, label, remaining_percent, reset_at, timezone,
                    tracking_source, usage_updated_at, usage_is_stale, reset_reached_at,
                    before_reset_hours, remind_reset_day, remind_reset_reached, created_at, updated_at
             FROM agent_quota_windows
             ORDER BY account_id, reset_at, lower(label), id",
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn save_quota(
        &self,
        input: SaveQuotaWindow,
    ) -> Result<StoredQuotaWindow, AgentUsageError> {
        if let Some(hours) = input.reminders.before_reset_hours {
            if hours < 1 || hours > 720 {
                return Err(AgentUsageError::InvalidInput);
            }
            let scheduled_for = input.reset_at - Duration::hours(hours as i64);
            if scheduled_for <= Utc::now() {
                return Err(AgentUsageError::InvalidInput);
            }
        }

        let id = input.id.unwrap_or_else(Uuid::new_v4);
        let now = Utc::now().to_rfc3339();
        let mut transaction = self.pool.begin().await?;
        let result = if input.id.is_some() {
            sqlx::query(
                "UPDATE agent_quota_windows
                 SET label = ?, normalized_label = ?, remaining_percent = ?, reset_at = ?,
                     timezone = ?, tracking_source = ?, usage_updated_at = ?, usage_is_stale = 0,
                     reset_reached_at = NULL, before_reset_hours = ?, remind_reset_day = ?,
                     remind_reset_reached = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ? AND account_id = ?",
            )
            .bind(input.label.trim())
            .bind(normalize(&input.label))
            .bind(input.remaining_percent)
            .bind(input.reset_at.to_rfc3339())
            .bind(&input.timezone)
            .bind(input.tracking_source.as_str())
            .bind(input.remaining_percent.map(|_| now.clone()))
            .bind(input.reminders.before_reset_hours)
            .bind(input.reminders.reset_day)
            .bind(input.reminders.reset_reached)
            .bind(id.to_string())
            .bind(input.account_id.to_string())
            .execute(&mut *transaction)
            .await
        } else {
            sqlx::query(
                "INSERT INTO agent_quota_windows (
                    id, account_id, label, normalized_label, remaining_percent, reset_at,
                    timezone, tracking_source, usage_updated_at, before_reset_hours,
                    remind_reset_day, remind_reset_reached
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(id.to_string())
            .bind(input.account_id.to_string())
            .bind(input.label.trim())
            .bind(normalize(&input.label))
            .bind(input.remaining_percent)
            .bind(input.reset_at.to_rfc3339())
            .bind(&input.timezone)
            .bind(input.tracking_source.as_str())
            .bind(input.remaining_percent.map(|_| now))
            .bind(input.reminders.before_reset_hours)
            .bind(input.reminders.reset_day)
            .bind(input.reminders.reset_reached)
            .execute(&mut *transaction)
            .await
        };
        match result {
            Ok(result) if input.id.is_some() && result.rows_affected() == 0 => {
                return Err(AgentUsageError::NotFound)
            }
            Ok(_) => {}
            Err(error) if is_unique_violation(&error) => {
                return Err(AgentUsageError::DuplicateQuota)
            }
            Err(error) => return Err(error.into()),
        }
        replace_reminders(&mut transaction, id, &input).await?;
        transaction.commit().await?;
        self.quota(input.account_id, id).await
    }

    pub(crate) async fn delete_quota(
        &self,
        account_id: Uuid,
        id: Uuid,
    ) -> Result<(), AgentUsageError> {
        let result = sqlx::query("DELETE FROM agent_quota_windows WHERE id = ? AND account_id = ?")
            .bind(id.to_string())
            .bind(account_id.to_string())
            .execute(&self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(AgentUsageError::NotFound);
        }
        Ok(())
    }

    pub(crate) async fn mark_elapsed_resets(
        &self,
        now: DateTime<Utc>,
    ) -> Result<u64, AgentUsageError> {
        Ok(sqlx::query(
            "UPDATE agent_quota_windows
             SET remaining_percent = NULL, usage_is_stale = 1, reset_reached_at = reset_at,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE reset_at <= ? AND (reset_reached_at IS NULL OR reset_reached_at <> reset_at)",
        )
        .bind(now.to_rfc3339())
        .execute(&self.pool)
        .await?
        .rows_affected())
    }

    pub(crate) async fn take_due_reminders(
        &self,
        now: DateTime<Utc>,
    ) -> Result<Vec<AgentReminder>, AgentUsageError> {
        let mut transaction = self.pool.begin().await?;
        let oldest = now - Duration::hours(48);
        sqlx::query(
            "UPDATE agent_reminders SET delivered_at = ?
             WHERE delivered_at IS NULL AND scheduled_for < ?",
        )
        .bind(now.to_rfc3339())
        .bind(oldest.to_rfc3339())
        .execute(&mut *transaction)
        .await?;
        let rows = sqlx::query_as::<_, ReminderRow>(
            "SELECT r.id, r.account_id, r.quota_window_id, r.kind, r.scheduled_for,
                    r.reset_occurrence AS reset_at, a.platform, a.custom_platform,
                    a.identifier, q.label AS quota_label
             FROM agent_reminders r
             JOIN agent_accounts a ON a.id = r.account_id
             JOIN agent_quota_windows q ON q.id = r.quota_window_id
             WHERE r.delivered_at IS NULL AND r.scheduled_for <= ? AND r.scheduled_for >= ?
             ORDER BY r.scheduled_for DESC, r.id
             LIMIT 100",
        )
        .bind(now.to_rfc3339())
        .bind(oldest.to_rfc3339())
        .fetch_all(&mut *transaction)
        .await?;
        for row in &rows {
            sqlx::query("UPDATE agent_reminders SET delivered_at = ? WHERE id = ?")
                .bind(now.to_rfc3339())
                .bind(&row.id)
                .execute(&mut *transaction)
                .await?;
        }
        transaction.commit().await?;

        let mut windows = HashSet::new();
        rows.into_iter()
            .filter(|row| windows.insert(row.quota_window_id.clone()))
            .take(10)
            .map(TryInto::try_into)
            .collect()
    }

    async fn account(&self, id: Uuid) -> Result<StoredAgentAccount, AgentUsageError> {
        sqlx::query_as::<_, AccountRow>(
            "SELECT id, platform, custom_platform, sign_in_method, identifier, tracking_mode,
                    default_timezone, created_at, updated_at
             FROM agent_accounts WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AgentUsageError::NotFound)?
        .try_into()
    }

    async fn quota(
        &self,
        account_id: Uuid,
        id: Uuid,
    ) -> Result<StoredQuotaWindow, AgentUsageError> {
        sqlx::query_as::<_, QuotaRow>(
            "SELECT id, account_id, label, remaining_percent, reset_at, timezone,
                    tracking_source, usage_updated_at, usage_is_stale, reset_reached_at,
                    before_reset_hours, remind_reset_day, remind_reset_reached, created_at, updated_at
             FROM agent_quota_windows WHERE id = ? AND account_id = ?",
        )
        .bind(id.to_string())
        .bind(account_id.to_string())
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AgentUsageError::NotFound)?
        .try_into()
    }
}

async fn replace_reminders(
    transaction: &mut Transaction<'_, Sqlite>,
    quota_id: Uuid,
    input: &SaveQuotaWindow,
) -> Result<(), AgentUsageError> {
    sqlx::query("DELETE FROM agent_reminders WHERE quota_window_id = ?")
        .bind(quota_id.to_string())
        .execute(&mut **transaction)
        .await?;
    let timezone = input
        .timezone
        .parse::<Tz>()
        .map_err(|_| AgentUsageError::InvalidInput)?;
    let local_reset = input.reset_at.with_timezone(&timezone);
    let local_midnight = local_reset
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .ok_or(AgentUsageError::InvalidInput)?;
    let reset_day = match timezone.from_local_datetime(&local_midnight) {
        LocalResult::Single(value) => value.with_timezone(&Utc),
        LocalResult::Ambiguous(_, _) | LocalResult::None => {
            return Err(AgentUsageError::InvalidInput)
        }
    };
    let mut reminders = Vec::new();
    if let Some(hours) = input.reminders.before_reset_hours {
        let scheduled_for = input.reset_at - Duration::hours(hours as i64);
        reminders.push((true, ReminderKind::BeforeReset, scheduled_for));
    }
    reminders.push((input.reminders.reset_day, ReminderKind::ResetDay, reset_day));
    reminders.push((
        input.reminders.reset_reached,
        ReminderKind::ResetReached,
        input.reset_at,
    ));

    for (enabled, kind, scheduled_for) in reminders {
        if !enabled {
            continue;
        }
        sqlx::query(
            "INSERT INTO agent_reminders (
                id, account_id, quota_window_id, kind, reset_occurrence, scheduled_for
             ) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(input.account_id.to_string())
        .bind(quota_id.to_string())
        .bind(kind.as_str())
        .bind(input.reset_at.to_rfc3339())
        .bind(scheduled_for.to_rfc3339())
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}

#[derive(Debug, FromRow)]
struct AccountRow {
    id: String,
    platform: String,
    custom_platform: Option<String>,
    sign_in_method: String,
    identifier: String,
    tracking_mode: String,
    default_timezone: String,
    created_at: String,
    updated_at: String,
}

impl TryFrom<AccountRow> for StoredAgentAccount {
    type Error = AgentUsageError;

    fn try_from(row: AccountRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            platform: AgentPlatform::try_from(row.platform.as_str())?,
            custom_platform: row.custom_platform,
            sign_in_method: SignInMethod::try_from(row.sign_in_method.as_str())?,
            identifier: row.identifier,
            tracking_mode: TrackingMode::try_from(row.tracking_mode.as_str())?,
            default_timezone: row.default_timezone,
            created_at: parse_time(&row.created_at)?,
            updated_at: parse_time(&row.updated_at)?,
        })
    }
}

#[derive(Debug, FromRow)]
struct QuotaRow {
    id: String,
    account_id: String,
    label: String,
    remaining_percent: Option<f64>,
    reset_at: String,
    timezone: String,
    tracking_source: String,
    usage_updated_at: Option<String>,
    usage_is_stale: bool,
    reset_reached_at: Option<String>,
    before_reset_hours: Option<i64>,
    remind_reset_day: bool,
    remind_reset_reached: bool,
    created_at: String,
    updated_at: String,
}

impl TryFrom<QuotaRow> for StoredQuotaWindow {
    type Error = AgentUsageError;

    fn try_from(row: QuotaRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            account_id: parse_uuid(&row.account_id)?,
            label: row.label,
            remaining_percent: row.remaining_percent,
            reset_at: parse_time(&row.reset_at)?,
            timezone: row.timezone,
            tracking_source: TrackingSource::try_from(row.tracking_source.as_str())?,
            usage_updated_at: row
                .usage_updated_at
                .as_deref()
                .map(parse_time)
                .transpose()?,
            usage_is_stale: row.usage_is_stale,
            reset_reached_at: row
                .reset_reached_at
                .as_deref()
                .map(parse_time)
                .transpose()?,
            reminders: ReminderPreferences {
                before_reset_hours: row.before_reset_hours.map(|h| h as u32),
                reset_day: row.remind_reset_day,
                reset_reached: row.remind_reset_reached,
            },
            created_at: parse_time(&row.created_at)?,
            updated_at: parse_time(&row.updated_at)?,
        })
    }
}

#[derive(Debug, FromRow)]
struct ReminderRow {
    id: String,
    account_id: String,
    quota_window_id: String,
    kind: String,
    scheduled_for: String,
    reset_at: String,
    platform: String,
    custom_platform: Option<String>,
    identifier: String,
    quota_label: String,
}

impl TryFrom<ReminderRow> for AgentReminder {
    type Error = AgentUsageError;

    fn try_from(row: ReminderRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            account_id: parse_uuid(&row.account_id)?,
            quota_window_id: parse_uuid(&row.quota_window_id)?,
            kind: ReminderKind::try_from(row.kind.as_str())?,
            platform: AgentPlatform::try_from(row.platform.as_str())?,
            custom_platform: row.custom_platform,
            identifier: row.identifier,
            quota_label: row.quota_label,
            reset_at: parse_time(&row.reset_at)?,
            scheduled_for: parse_time(&row.scheduled_for)?,
        })
    }
}

fn normalize(value: &str) -> String {
    value.trim().to_lowercase()
}

fn parse_uuid(value: &str) -> Result<Uuid, AgentUsageError> {
    Uuid::parse_str(value).map_err(|_| AgentUsageError::InvalidPersistedData)
}

fn parse_time(value: &str) -> Result<DateTime<Utc>, AgentUsageError> {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| AgentUsageError::InvalidPersistedData)
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database) if database.is_unique_violation())
}
