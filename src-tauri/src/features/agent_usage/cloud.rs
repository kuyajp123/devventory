use crate::shared::cloud::{select_records, CloudRecord};
use sqlx::SqliteConnection;

pub(crate) async fn cloud_records(
    connection: &mut SqliteConnection,
    account_id: &str,
) -> Result<Vec<CloudRecord>, sqlx::Error> {
    let mut records=select_records(connection,"agentAccount", "SELECT id,json_object('id',id,'platform',platform,'customPlatform',custom_platform,'signInMethod',sign_in_method,'identifier',identifier,'trackingMode',tracking_mode,'defaultTimezone',default_timezone,'createdAt',created_at,'updatedAt',updated_at) AS payload FROM agent_accounts WHERE id=?",&[account_id]).await?;
    if records.is_empty() {
        return Ok(records);
    }
    records.extend(select_records(connection,"quota", "SELECT id,json_object('id',id,'accountId',account_id,'label',label,'remainingPercent',remaining_percent,'resetAt',reset_at,'timezone',timezone,'trackingSource',tracking_source,'usageUpdatedAt',usage_updated_at,'usageIsStale',json(CASE WHEN usage_is_stale=1 THEN 'true' ELSE 'false' END),'resetReachedAt',reset_reached_at,'reminders',json_object('beforeResetHours',before_reset_hours,'resetDay',json(CASE WHEN remind_reset_day=1 THEN 'true' ELSE 'false' END),'resetReached',json(CASE WHEN remind_reset_reached=1 THEN 'true' ELSE 'false' END)),'createdAt',created_at,'updatedAt',updated_at) AS payload FROM agent_quota_windows WHERE account_id=? ORDER BY id",&[account_id]).await?);
    Ok(records)
}
