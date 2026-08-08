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
use super::reset_parser::{parse_pasted_reset, preview_exact_reset, preview_relative_reset};
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
        serde_json::to_value(ReminderKind::OneDayBefore).unwrap(),
        serde_json::json!("oneDayBefore")
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

#[test]
fn exact_and_relative_resets_are_timezone_safe_and_normalized() {
    let now = Utc.with_ymd_and_hms(2026, 8, 8, 12, 0, 0).unwrap();
    let exact = preview_exact_reset("2026-08-14", "15:00", "Asia/Manila")
        .expect("exact reset should parse");
    assert_eq!(exact.reset_at.to_rfc3339(), "2026-08-14T07:00:00+00:00");
    assert_eq!(exact.timezone, "Asia/Manila");

    let relative =
        preview_relative_reset(now, 6, 24, 0, "Asia/Manila").expect("relative reset should parse");
    assert_eq!(relative.reset_at.to_rfc3339(), "2026-08-15T12:00:00+00:00");
}

#[test]
fn pasted_reset_parser_handles_iso_relative_and_common_dates() {
    let now = Utc.with_ymd_and_hms(2026, 8, 8, 12, 0, 0).unwrap();

    let iso = parse_pasted_reset("2026-08-14T15:00:00+08:00", "Asia/Manila", now)
        .expect("ISO reset should parse");
    assert_eq!(iso.reset_at.to_rfc3339(), "2026-08-14T07:00:00+00:00");
    assert!(iso.had_explicit_timezone);

    let relative = parse_pasted_reset(
        "Your limit resets in 6 days and 4 hours",
        "Asia/Manila",
        now,
    )
    .expect("relative reset should parse");
    assert_eq!(relative.reset_at.to_rfc3339(), "2026-08-14T16:00:00+00:00");

    let weekday = parse_pasted_reset("Your limit resets Friday at 3:00 PM", "Asia/Manila", now)
        .expect("weekday reset should parse");
    assert_eq!(weekday.reset_at.to_rfc3339(), "2026-08-14T07:00:00+00:00");
    assert_eq!(weekday.timezone, "Asia/Manila");
    assert!(!weekday.had_explicit_timezone);

    let month = parse_pasted_reset("August 14 at 3 PM", "Asia/Manila", now)
        .expect("month reset should parse");
    assert_eq!(month.reset_at.to_rfc3339(), "2026-08-14T07:00:00+00:00");
}

#[test]
fn pasted_reset_parser_rejects_ambiguous_text() {
    let now = Utc.with_ymd_and_hms(2026, 8, 8, 12, 0, 0).unwrap();
    assert!(parse_pasted_reset("sometime Friday", "Asia/Manila", now).is_err());
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

    for (label, reset_at) in [
        ("5-hour", "2026-08-09T03:00:00Z"),
        ("Weekly", "2026-08-14T07:00:00Z"),
    ] {
        repository
            .save_quota(SaveQuotaWindow {
                id: None,
                account_id: first.id,
                label: label.to_owned(),
                remaining_percent: Some(50.0),
                reset_at: reset_at.parse().expect("valid timestamp"),
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
    repository
        .save_quota(SaveQuotaWindow {
            id: None,
            account_id: saved_account.id,
            label: "Weekly".to_owned(),
            remaining_percent: Some(0.0),
            reset_at: "2026-08-08T12:00:00Z".parse().unwrap(),
            timezone: "Asia/Manila".to_owned(),
            tracking_source: TrackingSource::Manual,
            reminders: ReminderPreferences::all(),
        })
        .await
        .unwrap();

    let now = Utc.with_ymd_and_hms(2026, 8, 8, 12, 1, 0).unwrap();
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
