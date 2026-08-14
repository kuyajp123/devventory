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
    let vault = CredentialVaultService::new(
        SqliteCredentialVaultRepository::new(initialization.database.pool().clone()),
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
        project_service,
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
}
