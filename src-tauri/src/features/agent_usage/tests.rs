use chrono::{TimeZone, Utc};
use tempfile::TempDir;
use uuid::Uuid;

use super::domain::{
    apply_elapsed_reset, derive_account_status, derive_next_reset, derive_reset_timing,
    AgentAvailability, QuotaWindowState, ResetTiming,
};
use super::error::AgentUsageError;
use super::model::{
    AgentPlatform, ReminderKind, ReminderPreferences, SaveAgentAccount, SaveQuotaWindow,
    SignInMethod, TrackingMode, TrackingSource,
};
use super::repository::SqliteAgentUsageRepository;
use crate::shared::database::{initialize_database, DatabasePaths};

fn quota(remaining_percent: Option<f64>, reset_at: &str) -> QuotaWindowState {
    QuotaWindowState {
        id: Uuid::new_v4(),
        remaining_percent,
        reset_at: reset_at.parse().expect("valid reset timestamp"),
        reset_reached_at: None,
        usage_is_stale: false,
    }
}

#[test]
fn ipc_enums_serialize_using_the_frontend_contract() {
    assert_eq!(
        serde_json::to_value(AgentPlatform::GithubCopilot).unwrap(),
        serde_json::json!("github_copilot")
    );
    assert_eq!(
        serde_json::to_value(AgentPlatform::ClaudeCode).unwrap(),
        serde_json::json!("claude_code")
    );
    assert_eq!(
        serde_json::to_value(SignInMethod::OrganizationSso).unwrap(),
        serde_json::json!("organization_sso")
    );
    assert_eq!(
        serde_json::to_value(TrackingMode::AutomaticConnector).unwrap(),
        serde_json::json!("automaticConnector")
    );
    assert_eq!(
        serde_json::to_value(ReminderKind::BeforeReset).unwrap(),
        serde_json::json!("beforeReset")
    );
}

#[test]
fn exhausted_window_blocks_an_account_after_another_window_resets() {
    let now = Utc.with_ymd_and_hms(2026, 8, 8, 12, 0, 0).unwrap();
    let mut elapsed = quota(Some(0.0), "2026-08-08T11:00:00Z");
    let weekly = quota(Some(0.0), "2026-08-14T07:00:00Z");

    assert!(apply_elapsed_reset(&mut elapsed, now));
    assert_eq!(elapsed.remaining_percent, None);
    assert!(elapsed.usage_is_stale);
    assert_eq!(elapsed.reset_reached_at, Some(elapsed.reset_at));
    assert_eq!(
        derive_account_status(&[elapsed, weekly], now),
        AgentAvailability::Exhausted
    );
}

#[test]
fn account_status_uses_known_usage_without_inventing_availability() {
    let now = Utc.with_ymd_and_hms(2026, 8, 8, 12, 0, 0).unwrap();

    assert_eq!(
        derive_account_status(&[quota(Some(75.0), "2026-08-14T07:00:00Z")], now),
        AgentAvailability::Available
    );
    assert_eq!(
        derive_account_status(&[quota(Some(20.0), "2026-08-14T07:00:00Z")], now),
        AgentAvailability::Limited
    );
    assert_eq!(
        derive_account_status(&[quota(None, "2026-08-14T07:00:00Z")], now),
        AgentAvailability::Unknown
    );
}

#[test]
fn reset_timing_uses_the_accounts_local_calendar_day() {
    let timezone = "Asia/Manila".parse().expect("valid timezone");
    let now = Utc.with_ymd_and_hms(2026, 8, 8, 15, 30, 0).unwrap();

    assert_eq!(
        derive_reset_timing(
            Utc.with_ymd_and_hms(2026, 8, 8, 16, 30, 0).unwrap(),
            timezone,
            now,
        ),
        ResetTiming::Tomorrow
    );
    assert_eq!(
        derive_reset_timing(
            Utc.with_ymd_and_hms(2026, 8, 8, 15, 45, 0).unwrap(),
            timezone,
            now,
        ),
        ResetTiming::Today
    );
    assert_eq!(
        derive_reset_timing(
            Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap(),
            timezone,
            now,
        ),
        ResetTiming::Elapsed
    );
}

#[test]
fn next_reset_uses_the_earliest_future_unreached_window() {
    let now = Utc.with_ymd_and_hms(2026, 8, 8, 12, 0, 0).unwrap();
    let elapsed = quota(None, "2026-08-08T11:00:00Z");
    let weekly = quota(Some(0.0), "2026-08-14T07:00:00Z");
    let daily = quota(Some(50.0), "2026-08-09T03:00:00Z");

    assert_eq!(
        derive_next_reset(&[weekly, elapsed, daily], now),
        Some(Utc.with_ymd_and_hms(2026, 8, 9, 3, 0, 0).unwrap())
    );
}

fn account(identifier: &str) -> SaveAgentAccount {
    SaveAgentAccount {
        id: None,
        platform: AgentPlatform::Codex,
        custom_platform: None,
        sign_in_method: SignInMethod::Google,
        identifier: identifier.to_owned(),
        tracking_mode: TrackingMode::Manual,
        default_timezone: "Asia/Manila".to_owned(),
    }
}

#[tokio::test]
async fn account_and_quota_persistence_is_global_and_cascades_intentionally() {
    let temp = TempDir::new().expect("temporary directory");
    let initialized = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should initialize");
    let repository = SqliteAgentUsageRepository::new(initialized.database.pool().clone());

    let first = repository
        .save_account(account("paul@example.com"))
        .await
        .expect("first account should save");
    let second = repository
        .save_account(account("work@example.com"))
        .await
        .expect("multiple accounts on one provider should save");
    assert_ne!(first.id, second.id);
    assert!(matches!(
        repository.save_account(account(" PAUL@example.com ")).await,
        Err(AgentUsageError::DuplicateAccount)
    ));

    let future_5h = Utc::now() + chrono::Duration::hours(48);
    let future_weekly = Utc::now() + chrono::Duration::days(7);

    for (label, reset_at) in [
        ("5-hour", future_5h),
        ("Weekly", future_weekly),
    ] {
        repository
            .save_quota(SaveQuotaWindow {
                id: None,
                account_id: first.id,
                label: label.to_owned(),
                remaining_percent: Some(50.0),
                reset_at,
                timezone: "Asia/Manila".to_owned(),
                tracking_source: TrackingSource::Manual,
                reminders: ReminderPreferences::all(),
            })
            .await
            .expect("quota should save");
    }
    assert_eq!(repository.list_quotas(first.id).await.unwrap().len(), 2);

    let project_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO projects (id, name, project_type, root_path, root_path_key)
         VALUES (?, 'Temporary project', 'other', 'C:/tmp/project', 'c:/tmp/project')",
    )
    .bind(project_id.to_string())
    .execute(initialized.database.pool())
    .await
    .expect("project fixture should save");
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(project_id.to_string())
        .execute(initialized.database.pool())
        .await
        .expect("project fixture should delete");
    assert_eq!(repository.list_accounts().await.unwrap().len(), 2);

    repository.delete_account(first.id).await.unwrap();
    assert!(repository.list_quotas(first.id).await.unwrap().is_empty());
    assert_eq!(repository.list_accounts().await.unwrap().len(), 1);
    initialized.database.close().await;
}

#[tokio::test]
async fn reminders_are_persisted_and_delivered_only_once_across_restarts() {
    let temp = TempDir::new().expect("temporary directory");
    let initialized = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should initialize");
    let repository = SqliteAgentUsageRepository::new(initialized.database.pool().clone());
    let saved_account = repository
        .save_account(account("paul@example.com"))
        .await
        .unwrap();

    let future_reset = Utc::now() + chrono::Duration::hours(2);
    repository
        .save_quota(SaveQuotaWindow {
            id: None,
            account_id: saved_account.id,
            label: "Weekly".to_owned(),
            remaining_percent: Some(0.0),
            reset_at: future_reset,
            timezone: "Asia/Manila".to_owned(),
            tracking_source: TrackingSource::Manual,
            reminders: ReminderPreferences {
                before_reset_hours: None,
                reset_day: false,
                reset_reached: true,
            },
        })
        .await
        .unwrap();

    let now = future_reset + chrono::Duration::minutes(1);
    let first_delivery = repository.take_due_reminders(now).await.unwrap();
    assert_eq!(first_delivery.len(), 1);
    assert_eq!(first_delivery[0].kind.as_str(), "reset_reached");
    assert!(repository.take_due_reminders(now).await.unwrap().is_empty());

    initialized.database.close().await;
    let reopened = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should reopen");
    let reopened_repository = SqliteAgentUsageRepository::new(reopened.database.pool().clone());
    assert!(reopened_repository
        .take_due_reminders(now)
        .await
        .unwrap()
        .is_empty());
    reopened.database.close().await;
}

#[tokio::test]
async fn past_custom_reminder_time_fails_validation_atomically() {
    let temp = TempDir::new().expect("temporary directory");
    let initialized = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should initialize");
    let repository = SqliteAgentUsageRepository::new(initialized.database.pool().clone());
    let saved_account = repository
        .save_account(account("paul@example.com"))
        .await
        .unwrap();

    let future_reset = Utc::now() + chrono::Duration::hours(2);
    let result = repository
        .save_quota(SaveQuotaWindow {
            id: None,
            account_id: saved_account.id,
            label: "Weekly".to_owned(),
            remaining_percent: Some(50.0),
            reset_at: future_reset,
            timezone: "Asia/Manila".to_owned(),
            tracking_source: TrackingSource::Manual,
            reminders: ReminderPreferences {
                before_reset_hours: Some(6),
                reset_day: true,
                reset_reached: true,
            },
        })
        .await;

    assert!(matches!(result, Err(AgentUsageError::InvalidInput)));
    assert!(repository.list_quotas(saved_account.id).await.unwrap().is_empty());
    initialized.database.close().await;
}

#[tokio::test]
async fn migration_converts_legacy_remind_one_day_to_before_reset_hours_24() {
    let temp = TempDir::new().expect("temporary directory");
    let initialized = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should initialize");

    let pool = initialized.database.pool();

    // Verify 0010 migration ran and schema updated
    let columns = sqlx::query("PRAGMA table_info(agent_quota_windows)")
        .fetch_all(pool)
        .await
        .unwrap();
    let col_names: Vec<String> = columns
        .into_iter()
        .map(|row| sqlx::Row::get::<String, _>(&row, "name"))
        .collect();

    assert!(col_names.contains(&"before_reset_hours".to_string()));
    assert!(!col_names.contains(&"remind_one_day".to_string()));

    // Verify table structure of agent_reminders
    let reminder_kinds = sqlx::query("SELECT DISTINCT kind FROM agent_reminders")
        .fetch_all(pool)
        .await
        .unwrap();
    for row in reminder_kinds {
        let kind: String = sqlx::Row::get(&row, "kind");
        assert_ne!(kind, "one_day_before");
    }

    initialized.database.close().await;
}
