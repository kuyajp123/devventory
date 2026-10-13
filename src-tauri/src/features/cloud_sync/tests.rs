use super::repository::SyncRepository;
use crate::shared::database::{initialize_database, DatabasePaths};
use sqlx::{Row, SqlitePool};
use tempfile::TempDir;

async fn database() -> (TempDir, SqlitePool) {
    let directory = tempfile::tempdir().unwrap();
    let init = initialize_database(&DatabasePaths::new(directory.path()))
        .await
        .unwrap();
    (directory, init.database.pool().clone())
}
async fn add_project(pool: &SqlitePool, id: &str) {
    sqlx::query("INSERT INTO projects (id,name,project_type,root_path,root_path_key) VALUES (?,'Test','desktop','C:/private',?)")
        .bind(id).bind(id).execute(pool).await.unwrap();
}

#[tokio::test]
async fn cloud_queue_is_transactional_durable_and_coalesces_edits() {
    let (_directory, pool) = database().await;
    let id = uuid::Uuid::new_v4().to_string();
    add_project(&pool, &id).await;
    let first: i64 = sqlx::query_scalar("SELECT revision FROM cloud_sync_scopes WHERE scope_id=?")
        .bind(&id)
        .fetch_one(&pool)
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("UPDATE projects SET name='Rolled back' WHERE id=?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.rollback().await.unwrap();
    let after: i64 = sqlx::query_scalar("SELECT revision FROM cloud_sync_scopes WHERE scope_id=?")
        .bind(&id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(first, after);
    sqlx::query("UPDATE projects SET name='Saved offline' WHERE id=?")
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cloud_sync_scopes WHERE scope_id=?")
        .bind(&id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    sqlx::query("DELETE FROM projects WHERE id=?")
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        sqlx::query_scalar::<_, i64>("SELECT revision FROM cloud_sync_scopes WHERE scope_id=?")
            .bind(&id)
            .fetch_one(&pool)
            .await
            .unwrap()
            > after
    );
    let enabled: i64 =
        sqlx::query_scalar("SELECT enabled FROM cloud_sync_config WHERE singleton=1")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(enabled, 0);
}

#[tokio::test]
async fn secret_value_and_note_changes_do_not_queue_tracker_uploads() {
    let (_directory, pool) = database().await;
    let project = uuid::Uuid::new_v4().to_string();
    add_project(&pool, &project).await;
    let source = uuid::Uuid::new_v4().to_string();
    let credential = uuid::Uuid::new_v4().to_string();
    let key = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO credential_sources(id,name,normalized_name) VALUES (?,'Source','source')",
    )
    .bind(&source)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO credentials(id,source_id,key_name,normalized_key_name) VALUES (?,?,'TOKEN','TOKEN')").bind(&credential).bind(&source).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO environment_key_definitions(id,project_id,name,normalized_name) VALUES (?,?,'TOKEN','TOKEN')").bind(&key).bind(&project).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO credential_project_links(credential_id,project_id,key_definition_id) VALUES (?,?,?)").bind(&credential).bind(&project).bind(&key).execute(&pool).await.unwrap();
    let before: i64 = sqlx::query_scalar("SELECT revision FROM cloud_sync_scopes WHERE scope_id=?")
        .bind(&project)
        .fetch_one(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE credentials SET key_name=key_name,source_id=source_id,notes='Never upload this',secret_reference=? WHERE id=?")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&credential)
        .execute(&pool)
        .await
        .unwrap();
    let row = sqlx::query("SELECT revision FROM cloud_sync_scopes WHERE scope_id=?")
        .bind(&project)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(before, row.get::<i64, _>(0));
}

#[tokio::test]
async fn prepared_upload_is_durable_and_old_acknowledgements_preserve_new_edits() {
    let (_directory, pool) = database().await;
    let id = uuid::Uuid::new_v4().to_string();
    add_project(&pool, &id).await;
    let repo = SyncRepository::new(pool.clone());
    repo.configure(
        "https://private.workers.dev",
        &uuid::Uuid::new_v4().to_string(),
        &uuid::Uuid::new_v4().to_string(),
    )
    .await
    .unwrap();
    let upload = repo.prepare_next().await.unwrap().unwrap();
    let serialized = serde_json::to_string(&upload).unwrap();
    assert!(!serialized.contains("C:/private"));
    assert!(!serialized.contains("rootPath"));
    assert!(serialized.contains("Test"));
    sqlx::query("UPDATE projects SET name='New edit during upload' WHERE id=?")
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    let restored = SyncRepository::new(pool.clone())
        .prepare_next()
        .await
        .unwrap()
        .unwrap();
    assert_eq!(upload.manifest.snapshot_id, restored.manifest.snapshot_id);
    repo.acknowledge(&upload, "2026-10-13T00:00:00Z")
        .await
        .unwrap();
    let next = repo.prepare_next().await.unwrap().unwrap();
    assert!(next.manifest.revision > upload.manifest.revision);
    assert!(serde_json::to_string(&next)
        .unwrap()
        .contains("New edit during upload"));
}

#[test]
fn cloud_urls_never_allow_credentials_redirect_targets_or_non_local_http() {
    use super::transport::validate_url;
    assert!(validate_url("https://private.workers.dev").is_ok());
    for url in [
        "http://private.workers.dev",
        "https://private.workers.dev.evil.example",
        "https://secret@private.workers.dev",
        "https://private.workers.dev/?token=secret",
        "file:///C:/private",
        "https://private.workers.dev/redirect",
    ] {
        assert!(validate_url(url).is_err(), "{url}");
    }
}

#[tokio::test]
async fn changing_worker_origin_requeues_already_acknowledged_metadata() {
    let (_directory, pool) = database().await;
    let project = uuid::Uuid::new_v4().to_string();
    add_project(&pool, &project).await;
    let repo = SyncRepository::new(pool);
    let workspace = uuid::Uuid::new_v4().to_string();
    let device = uuid::Uuid::new_v4().to_string();
    repo.configure("https://first.workers.dev", &workspace, &device)
        .await
        .unwrap();
    let upload = repo.prepare_next().await.unwrap().unwrap();
    repo.acknowledge(&upload, "2026-10-13T00:00:00Z")
        .await
        .unwrap();
    assert_eq!(repo.pending().await.unwrap(), 0);
    repo.configure("https://second.workers.dev", &workspace, &device)
        .await
        .unwrap();
    assert_eq!(repo.pending().await.unwrap(), 1);
    assert!(repo.config().await.unwrap().last_successful_at.is_none());
    assert!(
        repo.prepare_next()
            .await
            .unwrap()
            .unwrap()
            .manifest
            .revision
            > upload.manifest.revision
    );
}

#[test]
fn metadata_chunks_are_bounded_for_large_trackers() {
    use crate::shared::cloud::CloudRecord;
    let records = (0..10_000)
        .map(|index| {
            CloudRecord::new(
                "key",
                format!("key:{index}"),
                serde_json::json!({"name":format!("KEY_{index}")}),
            )
        })
        .collect();
    let chunks = super::model::pack_records(records).unwrap();
    assert_eq!(chunks.len(), 400);
    for chunk in chunks {
        assert!(chunk.len() <= 65_536);
        assert!(
            serde_json::from_str::<serde_json::Value>(&chunk).unwrap()["records"]
                .as_array()
                .unwrap()
                .len()
                <= 25
        );
    }
}

struct MemoryCredentials(std::sync::Mutex<std::collections::HashMap<String, String>>);
impl super::credentials::Credentials for MemoryCredentials {
    fn save(&self, identity: &str, token: &str) -> Result<(), ()> {
        self.0
            .lock()
            .unwrap()
            .insert(identity.to_owned(), token.to_owned());
        Ok(())
    }
    fn load(&self, identity: &str) -> Result<zeroize::Zeroizing<String>, ()> {
        self.0
            .lock()
            .unwrap()
            .get(identity)
            .cloned()
            .map(zeroize::Zeroizing::new)
            .ok_or(())
    }
}
struct ServerProcess(std::process::Child);
#[tokio::test]
async fn saved_publisher_credentials_cannot_be_reused_for_a_different_origin() {
    use super::service::{CloudSyncService, ConfigureSync};
    let (_directory, pool) = database().await;
    let service = CloudSyncService::with_credentials(
        pool,
        std::sync::Arc::new(MemoryCredentials(std::sync::Mutex::new(
            std::collections::HashMap::new(),
        ))),
    );
    let workspace = uuid::Uuid::new_v4().to_string();
    let device = uuid::Uuid::new_v4().to_string();
    service
        .configure(ConfigureSync {
            api_url: "https://trusted.workers.dev".into(),
            workspace_id: workspace.clone(),
            device_id: device.clone(),
            publisher_token: Some("a".repeat(64)),
        })
        .await
        .unwrap();
    let result = service
        .configure(ConfigureSync {
            api_url: "https://another.workers.dev".into(),
            workspace_id: workspace,
            device_id: device,
            publisher_token: None,
        })
        .await;
    assert!(
        result.is_err(),
        "Changing origin requires explicitly entering the credential again"
    );
}
impl Drop for ServerProcess {
    fn drop(&mut self) {
        self.0.stdin.take();
        let _ = self.0.wait();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn publishes_to_real_local_d1_and_resumes_offline_edits_after_restart() {
    use super::service::{CloudSyncService, ConfigureSync};
    use std::io::BufRead;
    use std::process::{Command, Stdio};
    use std::sync::Arc;
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap();
    let mut process = ServerProcess(
        Command::new("node")
            .arg("cloud/tests/acceptance-server.mjs")
            .current_dir(root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap(),
    );
    let mut ready = String::new();
    std::io::BufReader::new(process.0.stdout.take().unwrap())
        .read_line(&mut ready)
        .unwrap();
    let url = serde_json::from_str::<serde_json::Value>(&ready).expect("local Worker must start")
        ["url"]
        .as_str()
        .unwrap()
        .to_owned();
    let (directory, pool) = database().await;
    let project = uuid::Uuid::new_v4().to_string();
    add_project(&pool, &project).await;
    let environment = uuid::Uuid::new_v4().to_string();
    let source = uuid::Uuid::new_v4().to_string();
    let key = uuid::Uuid::new_v4().to_string();
    let rule = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO environments(id,project_id,name,normalized_name,sort_order) VALUES (?,?,'Production','production',0)").bind(&environment).bind(&project).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO environment_sources(id,project_id,environment_id,relative_path,normalized_path,sort_order,parse_status) VALUES (?,?,?,'private/config/.env','private/config/.env',0,'parsed')").bind(&source).bind(&project).bind(&environment).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO environment_key_definitions(id,project_id,name,normalized_name) VALUES (?,?,'DUPLICATE_KEY','DUPLICATE_KEY')").bind(&key).bind(&project).execute(&pool).await.unwrap();
    for line in [1, 2] {
        sqlx::query("INSERT INTO environment_key_occurrences(id,project_id,environment_id,source_id,key_definition_id,line_number,is_commented,is_duplicate) VALUES (?,?,?,?,?,?,0,1)").bind(uuid::Uuid::new_v4().to_string()).bind(&project).bind(&environment).bind(&source).bind(&key).bind(line).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO environment_key_rules(id,project_id,key_name,normalized_key,rule_type,severity,sort_order,enabled) VALUES (?,?,'MISSING_KEY','MISSING_KEY','required','error',0,1)").bind(&rule).bind(&project).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO environment_key_rule_targets(project_id,rule_id,environment_id) VALUES (?,?,?)").bind(&project).bind(&rule).bind(&environment).execute(&pool).await.unwrap();
    let account = uuid::Uuid::new_v4().to_string();
    let quota = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO agent_accounts(id,platform,sign_in_method,identifier,normalized_identifier,default_timezone) VALUES (?,'codex','email','synthetic@example.com','synthetic@example.com','Asia/Manila')").bind(&account).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO agent_quota_windows(id,account_id,label,normalized_label,remaining_percent,reset_at,timezone,tracking_source) VALUES (?,?,'Weekly','weekly',75,'2099-01-01T00:00:00Z','Asia/Manila','manual')").bind(&quota).bind(&account).execute(&pool).await.unwrap();
    let credentials = Arc::new(MemoryCredentials(std::sync::Mutex::new(
        std::collections::HashMap::new(),
    )));
    let service = CloudSyncService::with_credentials(pool.clone(), credentials.clone());
    let configuration = |api_url: String| ConfigureSync {
        api_url,
        workspace_id: "11111111-1111-4111-8111-111111111111".into(),
        device_id: "22222222-2222-4222-8222-222222222222".into(),
        publisher_token: Some("a".repeat(64)),
    };
    service.configure(configuration(url.clone())).await.unwrap();
    service.set_enabled(true, true).await.unwrap();
    for _ in 0..3 {
        service.synchronize(true).await.unwrap();
    }
    assert_eq!(service.status().await.unwrap().pending_scopes, 0);
    let initial_project_snapshot:String=sqlx::query_scalar("SELECT acknowledged_snapshot_id FROM cloud_sync_scopes WHERE scope_kind='project' AND scope_id=?").bind(&project).fetch_one(&pool).await.unwrap();
    let client = reqwest::Client::new();
    let read = |path: String| {
        client
            .get(format!("{url}{path}"))
            .bearer_auth("b".repeat(64))
            .send()
    };
    let cells: serde_json::Value = read(format!("/v1/projects/{project}/tracker?kind=cell"))
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert!(cells["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|cell| cell["data"]["state"] == "duplicate"));
    assert!(cells["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(
            |cell| cell["data"]["keyId"] == "key:MISSING_KEY" && cell["data"]["state"] == "absent"
        ));
    let sources: serde_json::Value = read(format!("/v1/projects/{project}/tracker?kind=source"))
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(sources["items"][0]["data"]["name"], ".env");
    assert!(!sources.to_string().contains("private/config"));
    let targets: serde_json::Value =
        read(format!("/v1/projects/{project}/tracker?kind=ruleTarget"))
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    assert_eq!(targets["items"][0]["data"]["ruleId"], rule);
    assert_eq!(targets["items"][0]["data"]["environmentId"], environment);
    assert_eq!(
        client
            .get(format!("{url}/v1/projects"))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    service
        .configure(configuration("http://127.0.0.1:1".into()))
        .await
        .unwrap();
    service.set_enabled(true, true).await.unwrap();
    sqlx::query("UPDATE projects SET name='Offline project edit' WHERE id=?")
        .bind(&project)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE agent_quota_windows SET remaining_percent=42 WHERE id=?")
        .bind(&quota)
        .execute(&pool)
        .await
        .unwrap();
    assert!(service.synchronize(true).await.is_err());
    assert_eq!(service.status().await.unwrap().state, "offline");
    pool.close().await;
    let init = initialize_database(&DatabasePaths::new(directory.path()))
        .await
        .unwrap();
    let resumed = CloudSyncService::with_credentials(init.database.pool().clone(), credentials);
    resumed.configure(configuration(url.clone())).await.unwrap();
    resumed.set_enabled(true, true).await.unwrap();
    resumed.start();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    while resumed.status().await.unwrap().pending_scopes > 0 {
        assert!(
            std::time::Instant::now() < deadline,
            "automatic reconnect must empty the queue"
        );
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }
    resumed.shutdown();
    let projects: serde_json::Value = read("/v1/projects".into())
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(projects["items"][0]["data"]["name"], "Offline project edit");
    let quotas: serde_json::Value = read(format!("/v1/agent-accounts/{account}/quotas"))
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(quotas["items"][0]["data"]["remainingPercent"], 42);
    // A restored DB can acquire higher counters through new offline edits.
    // Its old acknowledged snapshot must still prevent cloud overwrite.
    let current_snapshot = projects["items"][0]["snapshotId"]
        .as_str()
        .unwrap()
        .to_owned();
    sqlx::query("UPDATE cloud_sync_scopes SET acknowledged_snapshot_id=? WHERE scope_kind='project' AND scope_id=?").bind(initial_project_snapshot).bind(&project).execute(init.database.pool()).await.unwrap();
    for _ in 0..3 {
        sqlx::query("UPDATE projects SET name='Restored database edit' WHERE id=?")
            .bind(&project)
            .execute(init.database.pool())
            .await
            .unwrap();
    }
    assert!(resumed.synchronize(true).await.is_err());
    assert_eq!(resumed.status().await.unwrap().state, "recoveryRequired");
    let preserved: serde_json::Value = read("/v1/projects".into())
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(
        preserved["items"][0]["data"]["name"],
        "Offline project edit"
    );
    sqlx::query("UPDATE cloud_sync_scopes SET acknowledged_snapshot_id=? WHERE scope_kind='project' AND scope_id=?").bind(current_snapshot).bind(&project).execute(init.database.pool()).await.unwrap();
    sqlx::query("DELETE FROM projects WHERE id=?")
        .bind(&project)
        .execute(init.database.pool())
        .await
        .unwrap();
    resumed.synchronize(true).await.unwrap();
    let projects: serde_json::Value = read("/v1/projects".into())
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert!(projects["items"].as_array().unwrap().is_empty());
}
