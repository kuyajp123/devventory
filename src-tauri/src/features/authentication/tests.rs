use super::{
    config::FirebaseConfig,
    credentials::{SessionStore, SIGNED_OUT_MARKER},
    transport::FirebaseClient,
    AuthError, AuthService,
};
use std::sync::{Arc, Mutex};
use zeroize::Zeroizing;

#[derive(Default)]
struct MemoryStore(Mutex<Option<String>>);
impl SessionStore for MemoryStore {
    fn load(&self) -> Result<Option<Zeroizing<String>>, AuthError> {
        Ok(self.0.lock().unwrap().clone().map(Zeroizing::new))
    }
    fn save(&self, value: &str) -> Result<(), AuthError> {
        *self.0.lock().unwrap() = Some(value.into());
        Ok(())
    }
    fn clear(&self) -> Result<(), AuthError> {
        *self.0.lock().unwrap() = Some(SIGNED_OUT_MARKER.into());
        Ok(())
    }
}
fn server(responses: Vec<(u16, serde_json::Value)>) -> String {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    std::thread::spawn(move || {
        for (status, response) in responses {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
            let mut input = Vec::new();
            let mut block = [0; 2048];
            loop {
                let count = socket.read(&mut block).unwrap();
                input.extend_from_slice(&block[..count]);
                if let Some(end) = input.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&input[..end]).to_lowercase();
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            line.strip_prefix("content-length:")
                                .and_then(|value| value.trim().parse::<usize>().ok())
                        })
                        .unwrap_or(0);
                    if input.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            let body = response.to_string();
            write!(socket, "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
    });
    url
}
fn config() -> FirebaseConfig {
    FirebaseConfig {
        project_id: "synthetic-project".into(),
        project_number: None,
        api_key: "synthetic-key".into(),
        worker_url: "https://synthetic.workers.dev".into(),
    }
}
fn login() -> serde_json::Value {
    serde_json::json!({"localId":"alice","email":"alice@example.com","idToken":"synthetic-id-token","refreshToken":"synthetic-refresh-1","expiresIn":"3600"})
}
fn profile(verified: bool) -> serde_json::Value {
    serde_json::json!({"users":[{"localId":"alice","email":"alice@example.com","emailVerified":verified}]})
}

#[tokio::test]
async fn sign_in_keeps_credentials_native_and_sign_out_removes_them() {
    let store = Arc::new(MemoryStore::default());
    let client =
        FirebaseClient::for_test(&server(vec![(200, login()), (200, profile(true))])).unwrap();
    let service = AuthService::with_parts(config(), client, store.clone());
    let session = service
        .sign_in(
            "alice@example.com".into(),
            "synthetic-password".into(),
            false,
        )
        .await
        .unwrap();
    let public = serde_json::to_string(&session).unwrap();
    assert!(public.contains("alice@example.com"));
    assert!(!public.contains("synthetic-password"));
    assert!(!public.contains("synthetic-refresh"));
    assert!(!public.contains("synthetic-id-token"));
    assert!(!store
        .0
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .contains("synthetic-password"));
    assert!(matches!(
        service.authorization_for("bob").await,
        Err(AuthError::AccountMismatch)
    ));
    service.sign_out().await.unwrap();
    assert_eq!(store.0.lock().unwrap().as_deref(), Some(SIGNED_OUT_MARKER));
    assert_eq!(service.session().await.unwrap().state, "signedOut");
}
#[tokio::test]
async fn incorrect_password_has_a_safe_distinct_error_and_no_saved_credential() {
    let store = Arc::new(MemoryStore::default());
    let client = FirebaseClient::for_test(&server(vec![(
        400,
        serde_json::json!({"error":{"message":"INVALID_LOGIN_CREDENTIALS"}}),
    )]))
    .unwrap();
    let service = AuthService::with_parts(config(), client, store.clone());
    assert!(matches!(
        service
            .sign_in("alice@example.com".into(), "wrong-password".into(), false)
            .await,
        Err(AuthError::InvalidCredentials)
    ));
    assert!(store.0.lock().unwrap().is_none());
}
#[tokio::test]
async fn unverified_account_cannot_authorize_cloud_work() {
    let client =
        FirebaseClient::for_test(&server(vec![(200, login()), (200, profile(false))])).unwrap();
    let service = AuthService::with_parts(config(), client, Arc::new(MemoryStore::default()));
    service
        .sign_in(
            "alice@example.com".into(),
            "synthetic-password".into(),
            false,
        )
        .await
        .unwrap();
    assert!(matches!(
        service.authorization_for("alice").await,
        Err(AuthError::VerificationRequired)
    ));
}
#[tokio::test]
async fn refresh_survives_restart_rotates_credentials_and_is_single_flight() {
    let store = Arc::new(MemoryStore::default());
    let client =
        FirebaseClient::for_test(&server(vec![(200, login()), (200, profile(true))])).unwrap();
    let first = AuthService::with_parts(config(), client, store.clone());
    first
        .sign_in(
            "alice@example.com".into(),
            "synthetic-password".into(),
            false,
        )
        .await
        .unwrap();
    let client = FirebaseClient::for_test(&server(vec![
        (200, serde_json::json!({"user_id":"alice","project_id":"synthetic-project","id_token":"synthetic-new-id","refresh_token":"synthetic-refresh-2","expires_in":"3600"})),
        (200, profile(true)),
    ])).unwrap();
    let restarted = AuthService::with_parts(config(), client, store.clone());
    let (one, two) = tokio::join!(
        restarted.authorization_for("alice"),
        restarted.authorization_for("alice")
    );
    assert_eq!(one.unwrap().token.as_str(), "synthetic-new-id");
    assert_eq!(two.unwrap().token.as_str(), "synthetic-new-id");
    assert!(store
        .0
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .contains("synthetic-refresh-2"));
    let native = store.0.lock().unwrap().clone().unwrap();
    assert!(!native.contains("synthetic-new-id"));
}

fn remembered_store() -> Arc<MemoryStore> {
    Arc::new(MemoryStore(Mutex::new(Some(
        serde_json::json!({"account":{"userId":"alice","email":"alice@example.com","emailVerified":true},"refreshToken":"synthetic-refresh-1"}).to_string(),
    ))))
}
fn refreshed(project: &str) -> serde_json::Value {
    serde_json::json!({"user_id":"alice","project_id":project,"id_token":"synthetic-new-id","refresh_token":"synthetic-refresh-2","expires_in":"3600"})
}
#[tokio::test]
async fn temporary_refresh_failure_preserves_session_but_revoked_refresh_clears_it() {
    let store = remembered_store();
    let client = FirebaseClient::for_test(&server(vec![
        (503, serde_json::json!({})),
        (
            400,
            serde_json::json!({"error":{"message":"INVALID_REFRESH_TOKEN"}}),
        ),
    ]))
    .unwrap();
    let service = AuthService::with_parts(config(), client, store.clone());
    assert!(matches!(
        service.authorization_for("alice").await,
        Err(AuthError::Offline)
    ));
    assert_eq!(service.session().await.unwrap().state, "signedIn");
    assert!(store.0.lock().unwrap().is_some());
    assert!(matches!(
        service.authorization_for("alice").await,
        Err(AuthError::SessionExpired)
    ));
    assert_eq!(store.0.lock().unwrap().as_deref(), Some(SIGNED_OUT_MARKER));
    assert_eq!(service.session().await.unwrap().state, "signedOut");
}
#[tokio::test]
async fn rotated_refresh_is_preserved_even_when_profile_lookup_is_temporarily_offline() {
    let store = remembered_store();
    let client = FirebaseClient::for_test(&server(vec![
        (200, refreshed("synthetic-project")),
        (503, serde_json::json!({})),
    ]))
    .unwrap();
    let service = AuthService::with_parts(config(), client, store.clone());
    assert!(matches!(
        service.authorization_for("alice").await,
        Err(AuthError::Offline)
    ));
    assert!(store
        .0
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .contains("synthetic-refresh-2"));
    assert!(!store
        .0
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .contains("synthetic-new-id"));
}
#[tokio::test]
async fn refresh_accepts_configured_numeric_project_number_but_not_foreign_project() {
    let mut public_config = config();
    public_config.project_number = Some("1234567890".into());
    let client = FirebaseClient::for_test(&server(vec![
        (200, refreshed("1234567890")),
        (200, profile(true)),
    ]))
    .unwrap();
    let service = AuthService::with_parts(public_config.clone(), client, remembered_store());
    assert!(service.authorization_for("alice").await.is_ok());
    let client =
        FirebaseClient::for_test(&server(vec![(200, refreshed("foreign-project"))])).unwrap();
    let foreign = AuthService::with_parts(public_config, client, remembered_store());
    assert!(matches!(
        foreign.authorization_for("alice").await,
        Err(AuthError::InvalidResponse)
    ));
}

#[tokio::test]
async fn sign_out_clears_native_credentials_even_when_cloud_storage_is_unavailable() {
    let store = remembered_store();
    let service = AuthService::with_parts(config(), FirebaseClient::new().unwrap(), store.clone());
    assert_eq!(service.session().await.unwrap().state, "signedIn");
    let before = service.generation();
    let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
    let cloud = crate::features::cloud_sync::CloudSyncService::new(pool.clone(), service.clone());
    pool.close().await;
    let signed_out = super::commands::sign_out_and_pause(&service, &cloud)
        .await
        .unwrap();
    assert_eq!(signed_out.state, "signedOut");
    assert_eq!(store.0.lock().unwrap().as_deref(), Some(SIGNED_OUT_MARKER));
    assert!(service.generation() > before);
    assert!(matches!(
        service.authorization_for("alice").await,
        Err(AuthError::SessionExpired)
    ));
}

#[tokio::test]
async fn clearing_a_damaged_native_session_does_not_require_loading_it() {
    for value in [
        "not valid session JSON".to_owned(),
        serde_json::json!({"account":{"userId":"alice","email":"alice@example.com","emailVerified":true},"refreshToken":"x".repeat(2049)}).to_string(),
    ] {
        let store = Arc::new(MemoryStore(Mutex::new(Some(value))));
        let service = AuthService::with_parts(config(), FirebaseClient::new().unwrap(), store.clone());
        assert!(matches!(service.session().await, Err(AuthError::CredentialUnavailable)));
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        let cloud = crate::features::cloud_sync::CloudSyncService::new(pool.clone(), service.clone());
        pool.close().await;
        assert_eq!(super::commands::sign_out_and_pause(&service, &cloud).await.unwrap().state, "signedOut");
        assert_eq!(store.0.lock().unwrap().as_deref(), Some(SIGNED_OUT_MARKER));
        assert_eq!(service.session().await.unwrap().state, "signedOut");
    }
}

#[tokio::test]
async fn restarted_account_or_unreadable_session_cannot_enable_legacy_publishing() {
    use crate::features::cloud_sync::CloudSyncService;
    use crate::shared::database::{initialize_database, DatabasePaths};
    for store in [
        remembered_store(),
        Arc::new(MemoryStore(Mutex::new(Some("damaged".into())))),
    ] {
        let directory = tempfile::tempdir().unwrap();
        let database = initialize_database(&DatabasePaths::new(directory.path()))
            .await
            .unwrap();
        let pool = database.database.pool().clone();
        sqlx::query("UPDATE cloud_sync_config SET enabled=1,api_url='https://synthetic.workers.dev',workspace_id=?,device_id=?")
            .bind(uuid::Uuid::new_v4().to_string()).bind(uuid::Uuid::new_v4().to_string()).execute(&pool).await.unwrap();
        let authentication =
            AuthService::with_parts(config(), FirebaseClient::new().unwrap(), store);
        let cloud = CloudSyncService::new(pool.clone(), authentication);
        let rejected = cloud.set_enabled(true, true).await.unwrap_err();
        assert!([
            AuthError::AccountMismatch.code(),
            AuthError::CredentialUnavailable.code()
        ]
        .contains(&rejected.code()));
        pool.close().await;
    }
}

#[tokio::test]
async fn sign_out_pause_survives_restart_when_sqlite_cannot_save_the_pause() {
    use crate::features::cloud_sync::CloudSyncService;
    use crate::shared::database::{initialize_database, DatabasePaths};
    let directory = tempfile::tempdir().unwrap();
    let database = initialize_database(&DatabasePaths::new(directory.path()))
        .await
        .unwrap();
    let pool = database.database.pool().clone();
    sqlx::query("UPDATE cloud_sync_config SET enabled=1,api_url='https://synthetic.workers.dev',workspace_id=?,device_id=?")
        .bind(uuid::Uuid::new_v4().to_string()).bind(uuid::Uuid::new_v4().to_string()).execute(&pool).await.unwrap();
    sqlx::query("CREATE TRIGGER reject_account_pause BEFORE UPDATE OF enabled ON cloud_sync_config WHEN NEW.enabled=0 BEGIN SELECT RAISE(FAIL, 'synthetic pause failure'); END")
        .execute(&pool).await.unwrap();
    let store = remembered_store();
    let authentication =
        AuthService::with_parts(config(), FirebaseClient::new().unwrap(), store.clone());
    let cloud = CloudSyncService::new(pool.clone(), authentication.clone());
    assert_eq!(
        super::commands::sign_out_and_pause(&authentication, &cloud)
            .await
            .unwrap()
            .state,
        "signedOut"
    );
    let saved = store.0.lock().unwrap().clone().unwrap_or_default();
    assert!(!saved.contains("synthetic-refresh"));
    assert!(!saved.contains("alice"));
    sqlx::query("DROP TRIGGER reject_account_pause")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT enabled FROM cloud_sync_config")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    let restarted_authentication =
        AuthService::with_parts(config(), FirebaseClient::new().unwrap(), store);
    assert_eq!(
        restarted_authentication.session().await.unwrap().state,
        "signedOut"
    );
    let restarted_cloud = CloudSyncService::new(pool.clone(), restarted_authentication);
    assert!(
        restarted_cloud.set_enabled(true, true).await.is_err(),
        "Restart must not reinterpret a cleared account as permission for legacy publishing"
    );
    pool.close().await;
}

#[tokio::test]
async fn failed_native_clear_does_not_report_a_damaged_session_as_cleared() {
    struct RejectingClearStore(MemoryStore);
    impl SessionStore for RejectingClearStore {
        fn load(&self) -> Result<Option<Zeroizing<String>>, AuthError> {
            self.0.load()
        }
        fn save(&self, value: &str) -> Result<(), AuthError> {
            self.0.save(value)
        }
        fn clear(&self) -> Result<(), AuthError> {
            Err(AuthError::CredentialUnavailable)
        }
    }
    let store = Arc::new(RejectingClearStore(MemoryStore(Mutex::new(Some(
        "damaged".into(),
    )))));
    let authentication =
        AuthService::with_parts(config(), FirebaseClient::new().unwrap(), store.clone());
    assert!(matches!(
        authentication.session().await,
        Err(AuthError::CredentialUnavailable)
    ));
    assert!(matches!(
        authentication.sign_out().await,
        Err(AuthError::CredentialUnavailable)
    ));
    assert!(matches!(authentication.session().await, Err(AuthError::CredentialUnavailable)), "A failed clear must keep the status error recoverable instead of displaying signed-out success");
    assert_eq!(store.0 .0.lock().unwrap().as_deref(), Some("damaged"));
}
