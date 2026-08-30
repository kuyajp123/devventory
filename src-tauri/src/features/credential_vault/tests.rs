use sqlx::query_scalar;
use std::time::{Duration, Instant};
use tempfile::tempdir;
use uuid::Uuid;

use crate::features::environment_tracker::{
    CreateEnvironment, EnvironmentService, SqliteEnvironmentRepository,
};
use crate::features::projects::{
    CreateProject, LocalProjectFilesystem, ProjectService, ProjectType, SqliteProjectRepository,
};
use crate::shared::database::{initialize_database, DatabasePaths};
use crate::shared::errors::command::CommandError;

use super::dto::ValidatedImportEnvSecrets;
use super::error::CredentialVaultError;
use super::model::{
    CreateCredentials, CredentialEnvironmentLink, NewCredential, NewCredentialSource,
    UpdateCredential, UpdateCredentialSource,
};
use super::repository::SqliteCredentialVaultRepository;
use super::secret_store::CredentialSecretStore;
use super::service::CredentialVaultService;

#[tokio::test]
async fn vault_metadata_reads_and_mutations_require_an_unlocked_session() {
    let directory = tempdir().expect("temporary application directory");
    let initialization = initialize_database(&DatabasePaths::new(directory.path().join("data")))
        .await
        .expect("database initialization");
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(initialization.database.pool().clone()),
        LocalProjectFilesystem,
    );
    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(initialization.database.pool().clone()),
        project_service,
        directory.path(),
    );
    let source_input = NewCredentialSource {
        definition_key: None,
        name: "Protected source".to_owned(),
        description: None,
        project_ids: vec![],
        icon_source_path: None,
    };

    assert!(matches!(
        vault.list_sources().await,
        Err(CredentialVaultError::Locked)
    ));
    assert!(matches!(
        vault.create_source(source_input.clone()).await,
        Err(CredentialVaultError::Locked)
    ));

    let unlock_started = Instant::now();
    let (status, heartbeat_elapsed) =
        tokio::join!(vault.unlock("test master password".to_owned()), async {
            tokio::time::sleep(Duration::from_millis(25)).await;
            unlock_started.elapsed()
        });
    status.expect("vault setup");
    let unlock_elapsed = unlock_started.elapsed();
    assert!(
        heartbeat_elapsed < Duration::from_secs(1),
        "vault setup blocked the async runtime for {heartbeat_elapsed:?}"
    );
    assert!(
        unlock_elapsed < Duration::from_secs(5),
        "vault setup took too long for an interactive action: {unlock_elapsed:?}"
    );
    let source = vault
        .create_source(source_input)
        .await
        .expect("source creation while unlocked");
    let credential = vault
        .create_credentials(CreateCredentials {
            source_id: source.id,
            credentials: vec![NewCredential {
                key: "PROTECTED_KEY".to_owned(),
                notes: None,
                value: None,
                project_ids: vec![],
                environment_links: vec![],
            }],
        })
        .await
        .expect("credential creation while unlocked")
        .remove(0);
    vault.lock().expect("lock vault");

    assert!(matches!(
        vault.list_sources().await,
        Err(CredentialVaultError::Locked)
    ));
    assert!(matches!(
        vault.list_credentials(None).await,
        Err(CredentialVaultError::Locked)
    ));
    assert!(matches!(
        vault
            .update_source(UpdateCredentialSource {
                source_id: source.id,
                name: "Renamed source".to_owned(),
                description: None,
                project_ids: vec![],
                icon_source_path: None,
                remove_icon: false,
            })
            .await,
        Err(CredentialVaultError::Locked)
    ));
    assert!(matches!(
        vault
            .create_credentials(CreateCredentials {
                source_id: source.id,
                credentials: vec![NewCredential {
                    key: "ANOTHER_KEY".to_owned(),
                    notes: None,
                    value: None,
                    project_ids: vec![],
                    environment_links: vec![],
                }],
            })
            .await,
        Err(CredentialVaultError::Locked)
    ));
    assert!(matches!(
        vault
            .update_credential(UpdateCredential {
                credential_id: credential.id,
                key: "RENAMED_KEY".to_owned(),
                notes: None,
                project_ids: vec![],
                environment_links: vec![],
            })
            .await,
        Err(CredentialVaultError::Locked)
    ));
    assert!(matches!(
        vault.delete_credential(credential.id).await,
        Err(CredentialVaultError::Locked)
    ));
    assert!(matches!(
        vault.delete_source(source.id).await,
        Err(CredentialVaultError::Locked)
    ));
}

#[test]
fn incorrect_password_uses_a_distinct_safe_command_error_code() {
    let error = CommandError::from(CredentialVaultError::IncorrectPassword);

    assert_eq!(error.code(), "CREDENTIAL_VAULT_PASSWORD_INCORRECT");
    let serialized = serde_json::to_string(&error).expect("serializable command error");
    assert!(serialized.contains("The master password is incorrect"));
    assert!(!serialized.contains("credential-vault.hold"));
}

#[test]
fn stronghold_round_trip_preserves_exact_multiline_value_and_session_lock() {
    let directory = tempdir().expect("temporary vault directory");
    let store = CredentialSecretStore::new(directory.path());
    let reference = Uuid::new_v4();
    let value = "  -----BEGIN KEY-----\r\nabc  \r\n-----END KEY-----\n";

    let setup_started = Instant::now();
    let status = store.unlock("correct horse battery staple").expect("setup");
    assert!(
        setup_started.elapsed() < Duration::from_secs(5),
        "new vault setup exceeded the interactive latency budget"
    );
    assert!(status.is_configured);
    assert!(status.is_unlocked);
    store.save(reference, value).expect("save secret");
    assert_eq!(store.read(reference).expect("read secret"), value);

    store.lock().expect("lock vault");
    assert!(matches!(
        store.read(reference),
        Err(CredentialVaultError::Locked)
    ));

    let rejected_unlock_started = Instant::now();
    assert!(matches!(
        store.unlock("wrong password"),
        Err(CredentialVaultError::IncorrectPassword)
    ));
    assert!(
        rejected_unlock_started.elapsed() < Duration::from_secs(5),
        "wrong-password feedback exceeded the interactive latency budget"
    );
    let successful_unlock_started = Instant::now();
    store
        .unlock("correct horse battery staple")
        .expect("unlock existing vault");
    assert!(
        successful_unlock_started.elapsed() < Duration::from_secs(5),
        "existing vault unlock exceeded the interactive latency budget"
    );
    assert_eq!(store.read(reference).expect("read after unlock"), value);
}

#[tokio::test]
async fn vault_credentials_project_metadata_into_environment_tracker_without_plaintext() {
    let directory = tempdir().expect("temporary application directory");
    let project_root = directory.path().join("project");
    std::fs::create_dir_all(&project_root).expect("project root");
    let initialization = initialize_database(&DatabasePaths::new(directory.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    let project = project_service
        .create(CreateProject {
            name: "Vault project".to_owned(),
            description: None,
            project_type: ProjectType::Desktop,
            root_path: project_root.to_string_lossy().into_owned(),
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");
    let environment_service = EnvironmentService::new(
        SqliteEnvironmentRepository::new(pool.clone()),
        project_service.clone(),
    );
    let environment = environment_service
        .create(CreateEnvironment {
            project_id: project.id(),
            name: "Production".to_owned(),
            description: None,
        })
        .await
        .expect("environment creation");
    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(pool.clone()),
        project_service.clone(),
        directory.path(),
    );
    vault
        .unlock("test master password".to_owned())
        .await
        .expect("vault setup");
    let source = vault
        .create_source(NewCredentialSource {
            definition_key: Some("github".to_owned()),
            name: "GitHub Work".to_owned(),
            description: None,
            project_ids: vec![project.id()],
            icon_source_path: None,
        })
        .await
        .expect("source creation");
    let exact_value = "  -----BEGIN KEY-----\r\nabc  \r\n-----END KEY-----\n";
    let credentials = vault
        .create_credentials(CreateCredentials {
            source_id: source.id,
            credentials: vec![NewCredential {
                key: "TAURI_SIGNING_PRIVATE_KEY".to_owned(),
                notes: Some("Release signing".to_owned()),
                value: Some(exact_value.to_owned()),
                project_ids: vec![project.id()],
                environment_links: vec![CredentialEnvironmentLink {
                    project_id: project.id(),
                    environment_id: environment.id,
                }],
            }],
        })
        .await
        .expect("credential creation");

    assert_eq!(
        vault
            .reveal_secret(credentials[0].id)
            .await
            .expect("secret reveal"),
        exact_value
    );
    let projected = environment_service
        .list_custom_sources(project.id(), environment.id)
        .await
        .expect("environment projection");
    assert_eq!(projected.len(), 1);
    assert_eq!(projected[0].name, "GitHub Work");
    assert_eq!(projected[0].keys[0].name, "TAURI_SIGNING_PRIVATE_KEY");

    let credential_columns: Vec<String> =
        query_scalar("SELECT name FROM pragma_table_info('credentials') ORDER BY name")
            .fetch_all(&pool)
            .await
            .expect("credential schema columns");
    assert!(!credential_columns.iter().any(|column| {
        column.eq_ignore_ascii_case("value") || column.to_ascii_lowercase().contains("content")
    }));
    let persisted_secret_references: i64 =
        query_scalar("SELECT COUNT(*) FROM credentials WHERE secret_reference IS NOT NULL")
            .fetch_one(&pool)
            .await
            .expect("secret reference count");
    assert_eq!(persisted_secret_references, 1);

    environment_service
        .unlink_custom_source(project.id(), environment.id, source.id)
        .await
        .expect("unlink custom source from environment");

    let projected_after = environment_service
        .list_custom_sources(project.id(), environment.id)
        .await
        .expect("environment projection after unlink");
    assert_eq!(projected_after.len(), 0);

    let vault_sources = vault.list_sources().await.expect("list vault sources");
    assert_eq!(vault_sources.len(), 1);
    let vault_creds = vault
        .list_credentials(Some(source.id))
        .await
        .expect("list vault credentials");
    assert_eq!(vault_creds.len(), 1);
}

#[tokio::test]
async fn preview_and_import_env_file_secrets_into_vault() {
    let directory = tempdir().expect("temporary application directory");
    let project_root = directory.path().join("workspace");
    std::fs::create_dir_all(&project_root).expect("project directory");
    std::fs::write(
        project_root.join(".env.local"),
        "DATABASE_URL=postgres://user:pass@localhost:5432/mydb\nAPI_SECRET=\"super-secret-token\"\nPORT=8080\n# DISABLED_FLAG=off\n",
    )
    .expect("write .env.local");

    let initialization = initialize_database(&DatabasePaths::new(directory.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    let project = project_service
        .create(CreateProject {
            name: "Test Env Project".to_owned(),
            root_path: project_root.to_string_lossy().into_owned(),
            description: None,
            project_type: ProjectType::Web,
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");

    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(pool.clone()),
        project_service.clone(),
        directory.path(),
    );
    vault
        .unlock("test master password".to_owned())
        .await
        .expect("vault setup");

    // 1. Preview env file secrets
    let preview = vault
        .preview_env_secrets(project.id(), ".env.local")
        .await
        .expect("preview env secrets");
    assert_eq!(preview.len(), 4);
    assert_eq!(preview[0].key, "DATABASE_URL");
    assert!(!preview[0].is_commented);
    assert!(!preview[0].is_already_in_vault);
    assert_eq!(preview[1].key, "API_SECRET");
    assert_eq!(preview[2].key, "PORT");
    assert_eq!(preview[3].key, "DISABLED_FLAG");
    assert!(preview[3].is_commented);

    // 2. Import selected secrets into a new source
    let import_result = vault
        .import_env_file(ValidatedImportEnvSecrets {
            project_id: project.id(),
            relative_path: ".env.local".to_owned(),
            source_id: None,
            source_name: Some(".env.local".to_owned()),
            selected_keys: vec!["DATABASE_URL".to_owned(), "API_SECRET".to_owned()],
            environment_id: None,
        })
        .await
        .expect("import env file");

    assert_eq!(import_result.imported_count, 2);
    assert_eq!(import_result.updated_count, 0);

    // 3. Verify created credentials
    let credentials = vault
        .list_credentials(Some(import_result.source_id))
        .await
        .expect("list credentials");
    assert_eq!(credentials.len(), 2);

    let db_cred = credentials
        .iter()
        .find(|c| c.key == "DATABASE_URL")
        .expect("db cred");
    assert!(db_cred.has_value);
    let secret = vault
        .reveal_secret(db_cred.id)
        .await
        .expect("reveal db secret");
    assert_eq!(secret, "postgres://user:pass@localhost:5432/mydb");

    let api_cred = credentials
        .iter()
        .find(|c| c.key == "API_SECRET")
        .expect("api cred");
    assert!(api_cred.has_value);
    let api_secret = vault
        .reveal_secret(api_cred.id)
        .await
        .expect("reveal api secret");
    assert_eq!(api_secret, "super-secret-token");

    // 4. Verify preview now reflects that keys are in vault
    let preview_after = vault
        .preview_env_secrets(project.id(), ".env.local")
        .await
        .expect("preview after import");
    assert!(preview_after[0].is_already_in_vault);
    assert_eq!(
        preview_after[0].existing_source_name.as_deref(),
        Some(".env.local")
    );
}

#[tokio::test]
async fn delete_source_cascades_and_removes_all_credentials_and_secrets() {
    let directory = tempdir().expect("temporary application directory");
    let project_root = directory.path().join("cascade_test_project");
    std::fs::create_dir_all(&project_root).expect("create project root");

    let initialization = initialize_database(&DatabasePaths::new(directory.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();

    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    let project = project_service
        .create(CreateProject {
            name: "Cascade Test Project".to_owned(),
            root_path: project_root.to_string_lossy().into_owned(),
            description: None,
            project_type: ProjectType::Web,
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");

    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(pool.clone()),
        project_service.clone(),
        directory.path(),
    );
    vault
        .unlock("correct horse battery staple".to_owned())
        .await
        .expect("unlock vault");

    // 1. Create a source
    let source = vault
        .create_source(NewCredentialSource {
            definition_key: None,
            name: "Source To Delete".to_owned(),
            description: Some("Will be cascade deleted".to_owned()),
            project_ids: vec![project.id()],
            icon_source_path: None,
        })
        .await
        .expect("create source");

    // 2. Create credentials under the source with secret values
    let created_credentials = vault
        .create_credentials(CreateCredentials {
            source_id: source.id,
            credentials: vec![
                NewCredential {
                    key: "SECRET_KEY_1".to_owned(),
                    value: Some("secret-value-1".to_owned()),
                    notes: None,
                    project_ids: vec![project.id()],
                    environment_links: vec![],
                },
                NewCredential {
                    key: "SECRET_KEY_2".to_owned(),
                    value: Some("secret-value-2".to_owned()),
                    notes: None,
                    project_ids: vec![project.id()],
                    environment_links: vec![],
                },
            ],
        })
        .await
        .expect("create credentials");

    assert_eq!(created_credentials.len(), 2);
    assert_eq!(
        vault
            .reveal_secret(created_credentials[0].id)
            .await
            .expect("reveal 1"),
        "secret-value-1"
    );

    // 3. Delete the source
    let affected = vault.delete_source(source.id).await.expect("delete source");
    assert_eq!(affected, vec![project.id()]);

    // 4. Verify credentials are gone
    let remaining_creds = vault
        .list_credentials(Some(source.id))
        .await
        .expect("list credentials");
    assert!(remaining_creds.is_empty());

    // 5. Verify SQLite tables have 0 rows for this source
    let source_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM credential_sources WHERE id = ?")
            .bind(source.id.to_string())
            .fetch_one(&pool)
            .await
            .expect("count sources");
    assert_eq!(source_count, 0);

    let cred_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM credentials WHERE source_id = ?")
            .bind(source.id.to_string())
            .fetch_one(&pool)
            .await
            .expect("count credentials");
    assert_eq!(cred_count, 0);
}

#[tokio::test]
async fn import_env_file_with_active_duplicate_keys_fails() {
    let directory = tempdir().expect("temporary application directory");
    let project_root = directory.path().join("workspace");
    std::fs::create_dir_all(&project_root).expect("project directory");
    std::fs::write(
        project_root.join(".env.duplicate"),
        "API_KEY=first_val\nPORT=3000\nAPI_KEY=second_override_val\nDB_PASS=secret123\n",
    )
    .expect("write .env.duplicate");

    let initialization = initialize_database(&DatabasePaths::new(directory.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    let project = project_service
        .create(CreateProject {
            name: "Duplicate Keys Project".to_owned(),
            root_path: project_root.to_string_lossy().into_owned(),
            description: None,
            project_type: ProjectType::Web,
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");

    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(pool.clone()),
        project_service.clone(),
        directory.path(),
    );
    vault
        .unlock("correct password".to_owned())
        .await
        .expect("vault setup");

    let err = vault
        .import_env_file(ValidatedImportEnvSecrets {
            project_id: project.id(),
            relative_path: ".env.duplicate".to_owned(),
            source_id: None,
            source_name: Some("Deduplicated Source".to_owned()),
            selected_keys: vec![
                "API_KEY".to_owned(),
                "PORT".to_owned(),
                "DB_PASS".to_owned(),
            ],
            environment_id: None,
        })
        .await
        .expect_err("should reject duplicate active keys");

    match err {
        CredentialVaultError::DuplicateActiveKeys(msg) => {
            assert!(msg.contains("API_KEY"));
            assert!(msg.contains("lines 1, 3"));
        }
        other => panic!("expected DuplicateActiveKeys, got {:?}", other),
    }

    let sources = vault.list_sources().await.expect("list sources");
    assert_eq!(sources.len(), 0);
}

#[tokio::test]
async fn import_env_file_with_active_key_and_commented_duplicate_succeeds() {
    let directory = tempdir().expect("temporary application directory");
    let project_root = directory.path().join("workspace");
    std::fs::create_dir_all(&project_root).expect("project directory");
    std::fs::write(
        project_root.join(".env.mixed"),
        "API_KEY=active_val\nPORT=3000\n# API_KEY=commented_val\n# UNUSED=ignore_me\n",
    )
    .expect("write .env.mixed");

    let initialization = initialize_database(&DatabasePaths::new(directory.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    let project = project_service
        .create(CreateProject {
            name: "Mixed Keys Project".to_owned(),
            root_path: project_root.to_string_lossy().into_owned(),
            description: None,
            project_type: ProjectType::Web,
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");

    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(pool.clone()),
        project_service.clone(),
        directory.path(),
    );
    vault
        .unlock("correct password".to_owned())
        .await
        .expect("vault setup");

    let import_result = vault
        .import_env_file(ValidatedImportEnvSecrets {
            project_id: project.id(),
            relative_path: ".env.mixed".to_owned(),
            source_id: None,
            source_name: Some("Mixed Source".to_owned()),
            selected_keys: vec!["API_KEY".to_owned(), "PORT".to_owned(), "UNUSED".to_owned()],
            environment_id: None,
        })
        .await
        .expect("import env file with active and commented keys");

    assert_eq!(import_result.imported_count, 2);
    assert_eq!(import_result.updated_count, 0);

    let credentials = vault
        .list_credentials(Some(import_result.source_id))
        .await
        .expect("list credentials");
    assert_eq!(credentials.len(), 2);

    let api_key_cred = credentials
        .iter()
        .find(|c| c.key == "API_KEY")
        .expect("API_KEY cred");
    let revealed = vault
        .reveal_secret(api_key_cred.id)
        .await
        .expect("reveal API_KEY");
    assert_eq!(revealed, "active_val");
}

#[tokio::test]
async fn secret_store_batch_operations() {
    let directory = tempdir().expect("temporary application directory");
    let store = CredentialSecretStore::new(directory.path());
    store.unlock("master-pass").expect("unlock");

    let id1 = Uuid::new_v4();
    let id2 = Uuid::new_v4();
    let id3 = Uuid::new_v4();

    store
        .save_batch(&[(id1, "val-1"), (id2, "val-2"), (id3, "val-3")])
        .expect("save_batch");

    assert_eq!(store.read(id1).expect("read 1"), "val-1");
    assert_eq!(store.read(id2).expect("read 2"), "val-2");
    assert_eq!(store.read(id3).expect("read 3"), "val-3");

    store.delete_batch(&[id1, id2]).expect("delete_batch");
    assert!(store.read(id1).is_err());
    assert!(store.read(id2).is_err());
    assert_eq!(store.read(id3).expect("read 3"), "val-3");
}
