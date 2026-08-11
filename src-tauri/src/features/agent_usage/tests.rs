use chrono::{Duration, TimeZone, Utc};
use tempfile::TempDir;
use uuid::Uuid;

use super::domain::{
    apply_elapsed_reset, derive_account_status, derive_next_reset, derive_reset_timing,
    AgentAvailability, QuotaWindowState, ResetTiming,
};
use super::error::AgentUsageError;
use super::model::{
    AgentPlatform, ReminderKind, ReminderOutcome, ReminderPreferences, SaveAgentAccount,
    SaveQuotaWindow, SignInMethod, TrackingMode, TrackingSource,
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

    let future_5h = Utc::now() + Duration::hours(48);
    let future_weekly = Utc::now() + Duration::days(7);

    for (label, reset_at) in [("5-hour", future_5h), ("Weekly", future_weekly)] {
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
async fn reminder_lifecycle_claim_ack_grace_and_stale_behavior() {
    let temp = TempDir::new().expect("temporary directory");
    let initialized = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should initialize");
    let repository = SqliteAgentUsageRepository::new(initialized.database.pool().clone());
    let saved_account = repository
        .save_account(account("paul@example.com"))
        .await
        .unwrap();

    let reset_at = Utc::now() + Duration::hours(2);
    repository
        .save_quota(SaveQuotaWindow {
            id: None,
            account_id: saved_account.id,
            label: "Weekly".to_owned(),
            remaining_percent: Some(0.0),
            reset_at,
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

    // 1. Before scheduled time: claim returns no due reminders
    let before_due = reset_at - Duration::minutes(10);
    let batch1 = repository
        .claim_due_reminders(before_due, Duration::minutes(2))
        .await
        .unwrap();
    assert!(batch1.reminders.is_empty());

    // 2. At scheduled time (now): claim returns the due reminder
    let now = reset_at;
    let batch2 = repository
        .claim_due_reminders(now, Duration::minutes(2))
        .await
        .unwrap();
    assert_eq!(batch2.reminders.len(), 1);
    let reminder_id = batch2.reminders[0].id;

    // 3. Concurrent claim before lease expires: returns empty because it is already claimed
    let batch3 = repository
        .claim_due_reminders(now + Duration::seconds(30), Duration::minutes(2))
        .await
        .unwrap();
    assert!(batch3.reminders.is_empty());

    // 4. Stale acknowledgement with a wrong token: has no effect
    let wrong_token = Uuid::new_v4();
    repository
        .acknowledge_reminders(
            wrong_token,
            vec![ReminderOutcome::Delivered { id: reminder_id }],
            now,
        )
        .await
        .unwrap();

    // 5. Valid acknowledgement with matching batch_token: sets delivered status
    repository
        .acknowledge_reminders(
            batch2.batch_token,
            vec![ReminderOutcome::Delivered { id: reminder_id }],
            now,
        )
        .await
        .unwrap();

    // 6. Submitting claim again: delivered reminder is never re-claimed
    let batch4 = repository
        .claim_due_reminders(now + Duration::minutes(1), Duration::minutes(2))
        .await
        .unwrap();
    assert!(batch4.reminders.is_empty());

    initialized.database.close().await;
}

#[tokio::test]
async fn expired_claim_lease_recovery_and_stale_skipping() {
    let temp = TempDir::new().expect("temporary directory");
    let initialized = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should initialize");
    let repository = SqliteAgentUsageRepository::new(initialized.database.pool().clone());
    let saved_account = repository
        .save_account(account("paul@example.com"))
        .await
        .unwrap();

    let reset_at = Utc::now() + Duration::hours(2);
    repository
        .save_quota(SaveQuotaWindow {
            id: None,
            account_id: saved_account.id,
            label: "Weekly".to_owned(),
            remaining_percent: Some(0.0),
            reset_at,
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

    let now = reset_at;
    let batch = repository
        .claim_due_reminders(now, Duration::minutes(2))
        .await
        .unwrap();
    assert_eq!(batch.reminders.len(), 1);

    // Simulate crash / no ack. Fast-forward 3 minutes (lease expired at now+2m, grace ends at now+5m)
    let reclaim_time = now + Duration::minutes(3);
    let reclaimed = repository
        .claim_due_reminders(reclaim_time, Duration::minutes(2))
        .await
        .unwrap();
    assert_eq!(reclaimed.reminders.len(), 1);

    // Fast-forward past 5-minute grace window (now + 6 minutes)
    let stale_time = now + Duration::minutes(6);
    let stale_batch = repository
        .claim_due_reminders(stale_time, Duration::minutes(2))
        .await
        .unwrap();
    assert!(stale_batch.reminders.is_empty());

    initialized.database.close().await;
}

#[tokio::test]
async fn migration_0011_preserves_legacy_delivered_reminders() {
    let temp = TempDir::new().expect("temporary directory");
    let initialized = initialize_database(&DatabasePaths::new(temp.path()))
        .await
        .expect("database should initialize");

    let pool = initialized.database.pool();

    // Verify 0011 migration ran and agent_reminders table has new columns
    let columns = sqlx::query("PRAGMA table_info(agent_reminders)")
        .fetch_all(pool)
        .await
        .unwrap();
    let col_names: Vec<String> = columns
        .into_iter()
        .map(|row| sqlx::Row::get::<String, _>(&row, "name"))
        .collect();

    assert!(col_names.contains(&"status".to_string()));
    assert!(col_names.contains(&"claimed_at".to_string()));
    assert!(col_names.contains(&"claim_expires_at".to_string()));
    assert!(col_names.contains(&"claim_token".to_string()));
    assert!(col_names.contains(&"skipped_at".to_string()));
    assert!(col_names.contains(&"skip_reason".to_string()));

    initialized.database.close().await;
}

#[test]
fn format_notification_content_individual_and_burst() {
    use super::model::AgentReminder;
    use super::notification_dispatcher::format_notification_content;

    let now = Utc::now();
    let r1 = AgentReminder {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        quota_window_id: Uuid::new_v4(),
        kind: ReminderKind::ResetReached,
        platform: AgentPlatform::Antigravity,
        custom_platform: None,
        identifier: "paul@example.com".to_owned(),
        quota_label: "Weekly".to_owned(),
        reset_at: now,
        scheduled_for: now,
    };

    let (title1, body1) = format_notification_content(std::slice::from_ref(&r1));
    assert_eq!(title1, "Devventory");
    assert!(
        body1.contains("antigravity · paul@example.com · Weekly — Reset time has been reached.")
    );

    let r2 = AgentReminder {
        id: Uuid::new_v4(),
        account_id: Uuid::new_v4(),
        quota_window_id: Uuid::new_v4(),
        kind: ReminderKind::ResetDay,
        platform: AgentPlatform::Codex,
        custom_platform: None,
        identifier: "work@example.com".to_owned(),
        quota_label: "Daily".to_owned(),
        reset_at: now,
        scheduled_for: now,
    };

    let (title2, body2) = format_notification_content(&[r1, r2]);
    assert_eq!(title2, "Devventory");
    assert_eq!(
        body2,
        "2 Agent Usage reminders are ready. antigravity and codex have quota updates."
    );
}

#[test]
fn notification_delivery_plan_matches_focus_and_channel_policy() {
    use super::notification_dispatcher::{
        resolve_delivery_plan, DeliveryPlan, NotificationSurfaceContext,
    };
    use crate::features::settings::model::NotificationPreferences;

    let all_channels = NotificationPreferences {
        enabled: true,
        in_app_enabled: true,
        system_enabled: true,
    };
    assert_eq!(
        resolve_delivery_plan(&all_channels, NotificationSurfaceContext::MainFocused),
        DeliveryPlan::InAppToast
    );
    assert_eq!(
        resolve_delivery_plan(
            &all_channels,
            NotificationSurfaceContext::QuickAccessVisible
        ),
        DeliveryPlan::UnreadAndSystem
    );
    assert_eq!(
        resolve_delivery_plan(&all_channels, NotificationSurfaceContext::Background),
        DeliveryPlan::UnreadAndSystem
    );

    let in_app_only = NotificationPreferences {
        enabled: true,
        in_app_enabled: true,
        system_enabled: false,
    };
    assert_eq!(
        resolve_delivery_plan(&in_app_only, NotificationSurfaceContext::MainFocused),
        DeliveryPlan::InAppToast
    );
    assert_eq!(
        resolve_delivery_plan(&in_app_only, NotificationSurfaceContext::QuickAccessVisible),
        DeliveryPlan::UnreadOnly
    );
    assert_eq!(
        resolve_delivery_plan(&in_app_only, NotificationSurfaceContext::Background),
        DeliveryPlan::UnreadOnly
    );

    let system_only = NotificationPreferences {
        enabled: true,
        in_app_enabled: false,
        system_enabled: true,
    };
    for context in [
        NotificationSurfaceContext::MainFocused,
        NotificationSurfaceContext::QuickAccessVisible,
        NotificationSurfaceContext::Background,
    ] {
        assert_eq!(
            resolve_delivery_plan(&system_only, context),
            DeliveryPlan::SystemOnly
        );
    }

    let disabled = NotificationPreferences {
        enabled: false,
        in_app_enabled: true,
        system_enabled: true,
    };
    assert_eq!(
        resolve_delivery_plan(&disabled, NotificationSurfaceContext::Background),
        DeliveryPlan::Suppressed
    );
}
