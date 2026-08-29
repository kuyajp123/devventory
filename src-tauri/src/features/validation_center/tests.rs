use std::{collections::HashSet, fs, path::PathBuf};

use tempfile::{tempdir, TempDir};
use uuid::Uuid;

use crate::{
    features::{
        credential_vault::{
            CreateCredentials, CredentialEnvironmentLink, CredentialVaultService, NewCredential,
            NewCredentialSource, SqliteCredentialVaultRepository,
        },
        environment_tracker::{CreateEnvironment, EnvironmentService, SqliteEnvironmentRepository},
        file_inventory::{FileInventoryService, SqliteFileInventoryRepository},
        projects::{
            CreateProject, LocalProjectFilesystem, ProjectService, ProjectType,
            SqliteProjectRepository,
        },
    },
    shared::database::{initialize_database, DatabasePaths},
};

use super::domain::{calculate_health, evaluate, generate_manifest};
use super::model::{
    DetectedIssue, EnvironmentHealth, SaveValidationRule, ValidationEnvironment,
    ValidationEvaluation, ValidationIssueQuery, ValidationIssueSort, ValidationIssueStatus,
    ValidationIssueType, ValidationOccurrence, ValidationRule, ValidationRuleType,
    ValidationSeverity, ValidationSnapshot, ValidationSource, ValidationSourceStatus,
};
use super::{
    error::ValidationError, filesystem::LocalManifestFilesystem,
    repository::SqliteValidationRepository, service::ValidationService,
};

#[test]
fn required_optional_and_forbidden_rules_follow_active_occurrences() {
    let project_id = Uuid::new_v4();
    let local = environment("Local", 0);
    let production = environment("Production", 1);
    let local_source = source(
        local.id,
        "config/.env.local",
        ValidationSourceStatus::Parsed,
    );
    let production_source = source(
        production.id,
        "config/.env.production",
        ValidationSourceStatus::Parsed,
    );
    let database_id = Uuid::new_v4();
    let debug_id = Uuid::new_v4();
    let snapshot = ValidationSnapshot {
        project_id,
        environments: vec![local.clone(), production.clone()],
        sources: vec![local_source.clone(), production_source.clone()],
        occurrences: vec![
            occurrence(
                database_id,
                local.id,
                local_source.id,
                "DATABASE_URL",
                false,
                false,
            ),
            occurrence(
                database_id,
                production.id,
                production_source.id,
                "DATABASE_URL",
                true,
                false,
            ),
            occurrence(
                debug_id,
                production.id,
                production_source.id,
                "DEBUG",
                false,
                false,
            ),
        ],
        rules: vec![
            rule(
                project_id,
                "DATABASE_URL",
                ValidationRuleType::Required,
                ValidationSeverity::Error,
                vec![local.id, production.id],
                0,
            ),
            rule(
                project_id,
                "CACHE_URL",
                ValidationRuleType::Optional,
                ValidationSeverity::Warning,
                vec![local.id],
                1,
            ),
            rule(
                project_id,
                "DEBUG",
                ValidationRuleType::Forbidden,
                ValidationSeverity::Error,
                vec![production.id],
                2,
            ),
        ],
    };

    let result = evaluate(&snapshot);
    let states = result
        .issues
        .iter()
        .map(|issue| {
            (
                issue.issue_type,
                issue.environment_id,
                issue.key_name.as_str(),
            )
        })
        .collect::<HashSet<_>>();

    assert!(states.contains(&(
        ValidationIssueType::RequiredCommented,
        Some(production.id),
        "DATABASE_URL"
    )));
    assert!(states.contains(&(
        ValidationIssueType::ForbiddenPresent,
        Some(production.id),
        "DEBUG"
    )));
    assert!(!result
        .issues
        .iter()
        .any(|issue| issue.key_name == "CACHE_URL"));
    assert!(!result.issues.iter().any(|issue| {
        issue.issue_type == ValidationIssueType::RequiredMissing
            && issue.environment_id == Some(local.id)
    }));
}

#[test]
fn targeted_rules_do_not_validate_or_forbid_other_environments() {
    let project_id = Uuid::new_v4();
    let local = environment("Local", 0);
    let production = environment("Production", 1);
    let source = source(local.id, ".env.local", ValidationSourceStatus::Parsed);
    let snapshot = ValidationSnapshot {
        project_id,
        environments: vec![local.clone(), production.clone()],
        sources: vec![source.clone()],
        occurrences: vec![occurrence(
            Uuid::new_v4(),
            local.id,
            source.id,
            "VERCEL_AUTOMATION_BYPASS_SECRET",
            false,
            false,
        )],
        rules: vec![rule(
            project_id,
            "VERCEL_AUTOMATION_BYPASS_SECRET",
            ValidationRuleType::Required,
            ValidationSeverity::Error,
            vec![production.id],
            0,
        )],
    };

    let result = evaluate(&snapshot);

    assert!(result.issues.iter().any(|issue| {
        issue.issue_type == ValidationIssueType::RequiredMissing
            && issue.key_name == "VERCEL_AUTOMATION_BYPASS_SECRET"
            && issue.environment_id == Some(production.id)
    }));
    assert!(!result.issues.iter().any(|issue| {
        issue.key_name == "VERCEL_AUTOMATION_BYPASS_SECRET"
            && issue.environment_id == Some(local.id)
    }));
}

#[test]
fn duplicate_case_and_source_conditions_emit_only_safe_metadata() {
    let project_id = Uuid::new_v4();
    let local = environment("Local", 0);
    let parsed = source(local.id, ".env", ValidationSourceStatus::Parsed);
    let missing = source(local.id, ".env.local", ValidationSourceStatus::Missing);
    let mut invalid = source(local.id, ".env.invalid", ValidationSourceStatus::ParseIssue);
    invalid.issue_code = Some("invalid_key".to_owned());
    invalid.issue_line = Some(4);
    let key_definition_id = Uuid::new_v4();
    let mut mismatched = occurrence(
        key_definition_id,
        local.id,
        parsed.id,
        "Api_Key",
        false,
        true,
    );
    mismatched.key_name = "API_KEY".to_owned();
    let snapshot = ValidationSnapshot {
        project_id,
        environments: vec![local.clone()],
        sources: vec![parsed.clone(), missing, invalid],
        occurrences: vec![mismatched],
        rules: vec![rule(
            project_id,
            "API_KEY",
            ValidationRuleType::Optional,
            ValidationSeverity::Warning,
            vec![local.id],
            0,
        )],
    };

    let result = evaluate(&snapshot);
    let issue_types = result
        .issues
        .iter()
        .map(|issue| issue.issue_type)
        .collect::<HashSet<_>>();

    assert!(issue_types.contains(&ValidationIssueType::Duplicate));
    assert!(issue_types.contains(&ValidationIssueType::CaseMismatch));
    assert!(issue_types.contains(&ValidationIssueType::SourceUnreadable));
    assert!(issue_types.contains(&ValidationIssueType::InvalidName));
    assert!(result.issues.iter().all(|issue| {
        !issue.message.contains("secret-value")
            && issue.source_path.as_deref() != Some("secret-value")
    }));
}

#[test]
fn repeated_evaluation_produces_stable_unique_fingerprints() {
    let project_id = Uuid::new_v4();
    let local = environment("Local", 0);
    let snapshot = ValidationSnapshot {
        project_id,
        environments: vec![local.clone()],
        sources: vec![],
        occurrences: vec![],
        rules: vec![rule(
            project_id,
            "DATABASE_URL",
            ValidationRuleType::Required,
            ValidationSeverity::Error,
            vec![local.id],
            0,
        )],
    };

    let first = evaluate(&snapshot);
    let second = evaluate(&snapshot);
    let fingerprints = first
        .issues
        .iter()
        .map(|issue| issue.fingerprint.as_str())
        .collect::<HashSet<_>>();

    assert_eq!(first, second);
    assert_eq!(fingerprints.len(), first.issues.len());
    assert_eq!(first.issues[0].fingerprint.len(), 64);
}

#[test]
fn project_health_uses_only_open_issues_and_prioritizes_unknown() {
    assert_eq!(
        calculate_health([
            (
                &ValidationIssueType::RequiredMissing,
                ValidationIssueStatus::Open,
                ValidationSeverity::Error,
            ),
            (
                &ValidationIssueType::SourceUnreadable,
                ValidationIssueStatus::Open,
                ValidationSeverity::Error,
            ),
        ]),
        EnvironmentHealth::Unknown
    );
    assert_eq!(
        calculate_health([(
            &ValidationIssueType::Duplicate,
            ValidationIssueStatus::Open,
            ValidationSeverity::Warning,
        )]),
        EnvironmentHealth::Warning
    );
    assert_eq!(
        calculate_health([(
            &ValidationIssueType::RequiredMissing,
            ValidationIssueStatus::Ignored,
            ValidationSeverity::Error,
        )]),
        EnvironmentHealth::Healthy
    );
}

#[test]
fn manifest_uses_canonical_unique_keys_with_empty_values() {
    let project_id = Uuid::new_v4();
    let rules = vec![rule(
        project_id,
        "SUPABASE_URL",
        ValidationRuleType::Required,
        ValidationSeverity::Error,
        vec![Uuid::new_v4()],
        0,
    )];

    let manifest = generate_manifest(
        [
            ("Supabase_Url".to_owned(), "SUPABASE_URL".to_owned()),
            ("SMTP_HOST".to_owned(), "SMTP_HOST".to_owned()),
            ("SMTP_HOST".to_owned(), "SMTP_HOST".to_owned()),
        ],
        &rules,
    );

    assert_eq!(manifest, "SMTP_HOST=\nSUPABASE_URL=\n");
    assert!(!manifest.contains("secret-value"));
}

#[tokio::test]
async fn edits_disables_reenables_and_deletes_rules_without_losing_issue_history() {
    let context = TestContext::new("Rule lifecycle project").await;
    let environment_id = context.environment("Local").await;
    let created = context
        .service
        .save_rule(SaveValidationRule {
            project_id: context.project_id,
            rule_id: None,
            key_name: "DATABASE_URL".to_owned(),
            rule_type: ValidationRuleType::Required,
            severity: ValidationSeverity::Error,
            description: None,
            enabled: true,
            environment_ids: vec![environment_id],
        })
        .await
        .expect("created rule");

    let disabled = context
        .service
        .save_rule(SaveValidationRule {
            project_id: context.project_id,
            rule_id: Some(created.id),
            key_name: "DATABASE_URL".to_owned(),
            rule_type: ValidationRuleType::Required,
            severity: ValidationSeverity::Warning,
            description: Some("Required when database access is configured.".to_owned()),
            enabled: false,
            environment_ids: vec![environment_id],
        })
        .await
        .expect("edited disabled rule");
    assert_eq!(disabled.id, created.id);
    assert!(!disabled.enabled);
    assert_eq!(disabled.severity, ValidationSeverity::Warning);
    assert_eq!(
        context
            .service
            .summary(context.project_id)
            .await
            .expect("summary after disabling")
            .open_issues,
        0
    );

    let enabled = context
        .service
        .save_rule(SaveValidationRule {
            project_id: context.project_id,
            rule_id: Some(created.id),
            key_name: "DATABASE_URL".to_owned(),
            rule_type: ValidationRuleType::Required,
            severity: ValidationSeverity::Error,
            description: disabled.description,
            enabled: true,
            environment_ids: vec![environment_id],
        })
        .await
        .expect("re-enabled rule");
    assert!(enabled.enabled);
    assert_eq!(
        context
            .service
            .summary(context.project_id)
            .await
            .expect("summary after enabling")
            .open_issues,
        1
    );

    context
        .service
        .delete_rule(context.project_id, created.id)
        .await
        .expect("deleted rule");
    assert!(context
        .service
        .list_rules(context.project_id)
        .await
        .expect("rules after delete")
        .is_empty());
    let summary = context
        .service
        .summary(context.project_id)
        .await
        .expect("summary after delete");
    assert_eq!(summary.open_issues, 0);
    assert_eq!(summary.resolved_issues, 1);
}

#[tokio::test]
async fn persists_issue_lifecycle_and_failed_persistence_cannot_resolve_existing_issues() {
    let context = TestContext::new("Lifecycle project").await;
    let environment_id = context.environment("Local").await;
    let rule = context
        .service
        .save_rule(SaveValidationRule {
            project_id: context.project_id,
            rule_id: None,
            key_name: "DATABASE_URL".to_owned(),
            rule_type: ValidationRuleType::Required,
            severity: ValidationSeverity::Error,
            description: None,
            enabled: true,
            environment_ids: vec![environment_id],
        })
        .await
        .expect("required rule");
    assert!(matches!(
        context
            .service
            .save_rule(SaveValidationRule {
                project_id: context.project_id,
                rule_id: None,
                key_name: "DATABASE_URL".to_owned(),
                rule_type: ValidationRuleType::Forbidden,
                severity: ValidationSeverity::Error,
                description: None,
                enabled: true,
                environment_ids: vec![environment_id],
            })
            .await,
        Err(ValidationError::DuplicateRule)
    ));
    let optional_rule = context
        .service
        .save_rule(SaveValidationRule {
            project_id: context.project_id,
            rule_id: None,
            key_name: "CACHE_URL".to_owned(),
            rule_type: ValidationRuleType::Optional,
            severity: ValidationSeverity::Warning,
            description: None,
            enabled: true,
            environment_ids: vec![environment_id],
        })
        .await
        .expect("optional rule");
    context
        .service
        .reorder_rules(context.project_id, vec![optional_rule.id, rule.id])
        .await
        .expect("rule ordering");
    assert_eq!(
        context
            .service
            .list_rules(context.project_id)
            .await
            .expect("ordered rules")
            .into_iter()
            .map(|item| item.id)
            .collect::<Vec<_>>(),
        [optional_rule.id, rule.id]
    );
    let page = context
        .repository
        .list_issues(&issue_query(context.project_id, 1, 25))
        .await
        .expect("validation issues");
    assert_eq!(page.total_items, 1);
    let issue = page.items[0].clone();
    assert_eq!(issue.issue_type, ValidationIssueType::RequiredMissing);
    assert_eq!(
        context
            .repository
            .list_issues(&ValidationIssueQuery {
                rule_type: Some(ValidationRuleType::Required),
                ..issue_query(context.project_id, 1, 25)
            })
            .await
            .expect("required rule issues")
            .total_items,
        1
    );
    assert_eq!(
        context
            .repository
            .list_issues(&ValidationIssueQuery {
                rule_type: Some(ValidationRuleType::Optional),
                ..issue_query(context.project_id, 1, 25)
            })
            .await
            .expect("optional rule issues")
            .total_items,
        0
    );

    context
        .repository
        .set_issue_status(context.project_id, issue.id, ValidationIssueStatus::Ignored)
        .await
        .expect("ignore issue");
    context
        .service
        .validate(context.project_id)
        .await
        .expect("repeat validation");
    assert_eq!(
        context
            .repository
            .list_issues(&issue_query(context.project_id, 1, 25))
            .await
            .expect("ignored issue")
            .items[0]
            .status,
        ValidationIssueStatus::Ignored
    );
    context
        .repository
        .set_issue_status(context.project_id, issue.id, ValidationIssueStatus::Open)
        .await
        .expect("reopen issue");
    context
        .repository
        .set_issue_status(context.project_id, issue.id, ValidationIssueStatus::Ignored)
        .await
        .expect("ignore issue again");

    let invalid_evaluation = ValidationEvaluation {
        issues: vec![DetectedIssue {
            fingerprint: "a".repeat(64),
            environment_id: Some(Uuid::new_v4()),
            key_definition_id: None,
            rule_id: Some(rule.id),
            source_id: None,
            key_name: "OTHER_KEY".to_owned(),
            normalized_key: "OTHER_KEY".to_owned(),
            issue_type: ValidationIssueType::RequiredMissing,
            severity: ValidationSeverity::Error,
            message: "Required key 'OTHER_KEY' is missing.".to_owned(),
            source_path: None,
            line_number: None,
            observed_name: None,
        }],
    };
    assert!(context
        .repository
        .persist_evaluation(context.project_id, &invalid_evaluation)
        .await
        .is_err());
    assert_eq!(
        context
            .repository
            .list_issues(&issue_query(context.project_id, 1, 25))
            .await
            .expect("issue after rollback")
            .items[0]
            .status,
        ValidationIssueStatus::Ignored
    );

    context.write_source("config/local.env", b"DATABASE_URL=secret-value\n");
    context
        .environment_service
        .add_source(
            context.project_id,
            environment_id,
            "config/local.env".to_owned(),
        )
        .await
        .expect("environment source");
    context
        .service
        .validate(context.project_id)
        .await
        .expect("resolved validation");
    let resolved = context
        .repository
        .list_issues(&ValidationIssueQuery {
            status: Some(ValidationIssueStatus::Resolved),
            ..issue_query(context.project_id, 1, 25)
        })
        .await
        .expect("resolved issues");
    assert_eq!(resolved.total_items, 1);
    assert_eq!(resolved.items[0].status, ValidationIssueStatus::Resolved);
}

#[tokio::test]
async fn issue_queries_search_sort_and_paginate_thousands_without_crossing_projects() {
    let first = TestContext::new("Large project").await;
    let second = TestContext::new_in_workspace(&first, "Other project").await;
    let issues = (0..1_250)
        .map(|index| DetectedIssue {
            fingerprint: format!("{index:064x}"),
            environment_id: None,
            key_definition_id: None,
            rule_id: None,
            source_id: None,
            key_name: format!("KEY_{index:04}"),
            normalized_key: format!("KEY_{index:04}"),
            issue_type: ValidationIssueType::InvalidName,
            severity: if index % 2 == 0 {
                ValidationSeverity::Warning
            } else {
                ValidationSeverity::Info
            },
            message: format!("Key KEY_{index:04} has an invalid name."),
            source_path: Some(format!("config/source-{index:04}.env")),
            line_number: Some(1),
            observed_name: None,
        })
        .collect();
    first
        .repository
        .persist_evaluation(first.project_id, &ValidationEvaluation { issues })
        .await
        .expect("large issue persistence");

    let page = first
        .repository
        .list_issues(&issue_query(first.project_id, 50, 25))
        .await
        .expect("bounded issue page");
    assert_eq!(page.items.len(), 25);
    assert_eq!(page.total_items, 1_250);
    assert_eq!(page.total_pages, 50);

    let searched = first
        .repository
        .list_issues(&ValidationIssueQuery {
            search: Some("source-1249".to_owned()),
            ..issue_query(first.project_id, 1, 25)
        })
        .await
        .expect("server-side search");
    assert_eq!(searched.total_items, 1);
    assert_eq!(searched.items[0].key_name, "KEY_1249");
    assert_eq!(
        second
            .repository
            .list_issues(&issue_query(second.project_id, 1, 25))
            .await
            .expect("other project issues")
            .total_items,
        0
    );
}

#[tokio::test]
async fn manifest_preview_and_export_include_only_empty_values_and_refresh_inventory() {
    let context = TestContext::new("Manifest project").await;
    let environment_id = context.environment("Local").await;
    context.write_source("config/local.env", b"API_TOKEN=secret-value\n");
    context
        .environment_service
        .add_source(
            context.project_id,
            environment_id,
            "config/local.env".to_owned(),
        )
        .await
        .expect("environment source");

    let preview = context
        .service
        .manifest_preview(context.project_id, ".env.example".to_owned())
        .await
        .expect("manifest preview");
    assert_eq!(preview.content, "API_TOKEN=\n");
    assert!(!preview.content.contains("secret-value"));
    assert!(!preview.exists);

    let exported = context
        .service
        .export_manifest(
            context.project_id,
            ".env.example".to_owned(),
            super::model::ManifestCollisionChoice::Cancel,
        )
        .await
        .expect("manifest export");
    assert_eq!(exported.manifest.key_count, 1);
    assert!(exported.scan.files_discovered >= 2);
    assert_eq!(
        fs::read_to_string(context.root.join(".env.example")).expect("exported manifest"),
        "API_TOKEN=\n"
    );
}

#[tokio::test]
async fn custom_definitions_participate_in_required_and_duplicate_validation() {
    let context = TestContext::new("Custom validation project").await;
    let environment_id = context.environment("Production").await;
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(context.pool.clone()),
        LocalProjectFilesystem,
    );
    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(context.pool.clone()),
        project_service,
        context.root.parent().expect("workspace root"),
    );
    vault
        .unlock("validation integration test password".to_owned())
        .await
        .expect("vault setup");
    let source = vault
        .create_source(NewCredentialSource {
            definition_key: None,
            name: "Deployment secrets".to_owned(),
            description: None,
            project_ids: vec![context.project_id],
            icon_source_path: None,
        })
        .await
        .expect("custom source");
    vault
        .create_credentials(CreateCredentials {
            source_id: source.id,
            credentials: vec![NewCredential {
                key: "API_TOKEN".to_owned(),
                notes: None,
                value: None,
                project_ids: vec![context.project_id],
                environment_links: vec![CredentialEnvironmentLink {
                    project_id: context.project_id,
                    environment_id,
                }],
            }],
        })
        .await
        .expect("custom credential");
    context
        .service
        .save_rule(SaveValidationRule {
            project_id: context.project_id,
            rule_id: None,
            key_name: "API_TOKEN".to_owned(),
            rule_type: ValidationRuleType::Required,
            severity: ValidationSeverity::Error,
            description: None,
            enabled: true,
            environment_ids: vec![environment_id],
        })
        .await
        .expect("required custom key rule");
    assert!(!context
        .repository
        .list_issues(&issue_query(context.project_id, 1, 25))
        .await
        .expect("custom required issues")
        .items
        .iter()
        .any(|issue| issue.issue_type == ValidationIssueType::RequiredMissing));

    context.write_source("config/production.env", b"API_TOKEN=file-value\n");
    context
        .environment_service
        .add_source(
            context.project_id,
            environment_id,
            "config/production.env".to_owned(),
        )
        .await
        .expect("file source");
    context
        .service
        .validate(context.project_id)
        .await
        .expect("validation with file and custom definition");
    assert!(context
        .repository
        .list_issues(&issue_query(context.project_id, 1, 25))
        .await
        .expect("duplicate issues")
        .items
        .iter()
        .any(|issue| issue.issue_type == ValidationIssueType::Duplicate
            && issue.key_name == "API_TOKEN"
            && issue.environment_id == Some(environment_id)));
}

#[tokio::test]
async fn migration_0012_resolves_legacy_cross_environment_findings() {
    let context = TestContext::new("Validation scope migration").await;
    let local_id = context.environment("Local").await;
    let production_id = context.environment("Production").await;
    let rule = context
        .service
        .save_rule(SaveValidationRule {
            project_id: context.project_id,
            rule_id: None,
            key_name: "APP_SETTINGS_ENCRYPTION_KEY".to_owned(),
            rule_type: ValidationRuleType::Optional,
            severity: ValidationSeverity::Info,
            description: None,
            enabled: true,
            environment_ids: vec![local_id],
        })
        .await
        .expect("local-only rule");
    let issue_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO validation_issues (
            id, project_id, environment_id, rule_id, fingerprint, key_name,
            normalized_key, issue_type, severity, status, message, last_seen_run_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'unexpected_present', 'info', 'open', ?, ?)",
    )
    .bind(issue_id.to_string())
    .bind(context.project_id.to_string())
    .bind(production_id.to_string())
    .bind(rule.id.to_string())
    .bind("e".repeat(64))
    .bind("APP_SETTINGS_ENCRYPTION_KEY")
    .bind("APP_SETTINGS_ENCRYPTION_KEY")
    .bind("Legacy out-of-scope issue")
    .bind(Uuid::new_v4().to_string())
    .execute(&context.pool)
    .await
    .expect("legacy issue fixture");
    sqlx::query("UPDATE project_validation_state SET health = 'error' WHERE project_id = ?")
        .bind(context.project_id.to_string())
        .execute(&context.pool)
        .await
        .expect("legacy health fixture");
    sqlx::query("DELETE FROM _sqlx_migrations WHERE version = 12")
        .execute(&context.pool)
        .await
        .expect("version 12 rollback fixture");

    sqlx::migrate!("./migrations")
        .run(&context.pool)
        .await
        .expect("scope cleanup migration");

    let status: String = sqlx::query_scalar("SELECT status FROM validation_issues WHERE id = ?")
        .bind(issue_id.to_string())
        .fetch_one(&context.pool)
        .await
        .expect("migrated issue status");
    let health: String =
        sqlx::query_scalar("SELECT health FROM project_validation_state WHERE project_id = ?")
            .bind(context.project_id.to_string())
            .fetch_one(&context.pool)
            .await
            .expect("migrated validation health");

    assert_eq!(status, "resolved");
    assert_eq!(health, "healthy");
}

struct TestContext {
    _workspace: Option<TempDir>,
    root: PathBuf,
    pool: sqlx::SqlitePool,
    project_id: Uuid,
    environment_service: EnvironmentService,
    repository: SqliteValidationRepository,
    service: ValidationService,
}

impl TestContext {
    async fn new(name: &str) -> Self {
        let workspace = tempdir().expect("temporary workspace");
        let data = workspace.path().join("data");
        let initialization = initialize_database(&DatabasePaths::new(&data))
            .await
            .expect("database initialization");
        let pool = initialization.database.pool().clone();
        let base = workspace.path().to_path_buf();
        Self::create(Some(workspace), base, pool, name).await
    }

    async fn new_in_workspace(existing: &Self, name: &str) -> Self {
        let base = existing
            .root
            .parent()
            .expect("shared workspace")
            .to_path_buf();
        Self::create(None, base, existing.pool.clone(), name).await
    }

    async fn create(
        workspace: Option<TempDir>,
        base: PathBuf,
        pool: sqlx::SqlitePool,
        name: &str,
    ) -> Self {
        let root = base.join(format!("project-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("project root");
        let project_service = ProjectService::new(
            SqliteProjectRepository::new(pool.clone()),
            LocalProjectFilesystem,
        );
        let project = project_service
            .create(CreateProject {
                name: name.to_owned(),
                description: None,
                project_type: ProjectType::Web,
                root_path: root.to_string_lossy().into_owned(),
                watched_locations: vec![".".to_owned()],
                exclusions: vec![],
            })
            .await
            .expect("project creation");
        let project_id = project.id();
        let environment_service = EnvironmentService::new(
            SqliteEnvironmentRepository::new(pool.clone()),
            project_service.clone(),
        );
        let inventory_service = FileInventoryService::new(
            SqliteFileInventoryRepository::new(pool.clone()),
            project_service.clone(),
        );
        let repository = SqliteValidationRepository::new(pool.clone());
        let service = ValidationService::new(
            repository.clone(),
            project_service,
            inventory_service,
            LocalManifestFilesystem,
        );
        Self {
            _workspace: workspace,
            root,
            pool,
            project_id,
            environment_service,
            repository,
            service,
        }
    }

    async fn environment(&self, name: &str) -> Uuid {
        self.environment_service
            .create(CreateEnvironment {
                project_id: self.project_id,
                name: name.to_owned(),
                description: None,
            })
            .await
            .expect("environment creation")
            .id
    }

    fn write_source(&self, relative_path: &str, content: &[u8]) {
        let path = self.root.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("source parent");
        }
        fs::write(path, content).expect("environment source fixture");
    }
}

fn issue_query(project_id: Uuid, page: u32, page_size: u32) -> ValidationIssueQuery {
    ValidationIssueQuery {
        project_id,
        search: None,
        environment_id: None,
        issue_type: None,
        rule_type: None,
        severity: None,
        status: None,
        sort: ValidationIssueSort::UpdatedAt,
        descending: true,
        page,
        page_size,
    }
}

fn environment(name: &str, sort_order: u32) -> ValidationEnvironment {
    ValidationEnvironment {
        id: Uuid::new_v4(),
        name: name.to_owned(),
        sort_order,
    }
}

fn source(
    environment_id: Uuid,
    relative_path: &str,
    status: ValidationSourceStatus,
) -> ValidationSource {
    ValidationSource {
        id: Uuid::new_v4(),
        environment_id,
        relative_path: relative_path.to_owned(),
        status,
        issue_code: None,
        issue_line: None,
    }
}

fn occurrence(
    key_definition_id: Uuid,
    environment_id: Uuid,
    source_id: Uuid,
    observed_name: &str,
    is_commented: bool,
    is_duplicate: bool,
) -> ValidationOccurrence {
    ValidationOccurrence {
        key_definition_id,
        environment_id,
        source_id,
        key_name: observed_name.to_owned(),
        observed_name: observed_name.to_owned(),
        normalized_key: observed_name.to_ascii_uppercase(),
        line_number: Some(1),
        is_commented,
        is_duplicate,
    }
}

fn rule(
    project_id: Uuid,
    key_name: &str,
    rule_type: ValidationRuleType,
    severity: ValidationSeverity,
    environment_ids: Vec<Uuid>,
    sort_order: u32,
) -> ValidationRule {
    ValidationRule {
        id: Uuid::new_v4(),
        project_id,
        key_name: key_name.to_owned(),
        rule_type,
        severity,
        description: None,
        sort_order,
        enabled: true,
        environment_ids,
        created_at: "2026-08-08T00:00:00.000Z".to_owned(),
        updated_at: "2026-08-08T00:00:00.000Z".to_owned(),
    }
}
