use super::model::{
    digest, pack_records, ChunkManifest, PreparedUpload, SnapshotManifest, SyncConfig,
    UploadPreview,
};
use crate::features::{agent_usage, environment_tracker, projects, validation_center};
use chrono::Utc;
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub(crate) struct SyncRepository {
    pool: SqlitePool,
}
impl SyncRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
    pub(crate) async fn config(&self) -> Result<SyncConfig, sqlx::Error> {
        sqlx::query_as("SELECT owner_uid,enabled,api_url,workspace_id,device_id,stream_id,last_successful_at,blocked_code,retry_at,retry_attempt FROM cloud_sync_config WHERE singleton=1").fetch_one(&self.pool).await
    }
    pub(crate) async fn configure(
        &self,
        url: &str,
        workspace: &str,
        device: &str,
    ) -> Result<(), sqlx::Error> {
        self.configure_owned(url, workspace, device, None).await
    }
    pub(crate) async fn registration_id(&self, uid: &str) -> Result<String, sqlx::Error> {
        sqlx::query("INSERT OR IGNORE INTO cloud_sync_device_registrations(firebase_uid,registration_id) VALUES (?,?)").bind(uid).bind(Uuid::new_v4().to_string()).execute(&self.pool).await?;
        sqlx::query_scalar(
            "SELECT registration_id FROM cloud_sync_device_registrations WHERE firebase_uid=?",
        )
        .bind(uid)
        .fetch_one(&self.pool)
        .await
    }
    pub(crate) async fn configure_owned(
        &self,
        url: &str,
        workspace: &str,
        device: &str,
        owner_uid: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        let previous = self.config().await?;
        let mut tx = self.pool.begin().await?;
        if previous.workspace_id.as_deref() != Some(workspace)
            || previous.device_id.as_deref() != Some(device)
        {
            sqlx::query("DELETE FROM cloud_sync_uploads")
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE cloud_sync_scopes SET acknowledged_revision=0,acknowledged_snapshot_id=NULL")
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE cloud_sync_config SET stream_id=?,last_successful_at=NULL WHERE singleton=1").bind(Uuid::new_v4().to_string()).execute(&mut *tx).await?;
        } else if previous.api_url != url {
            // A new destination must receive all metadata, even if the old
            // destination acknowledged it. Retain lineage for safe reconnects.
            sqlx::query("UPDATE cloud_sync_scopes SET revision=revision+1,changed_at=unixepoch()")
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE cloud_sync_config SET last_successful_at=NULL WHERE singleton=1")
                .execute(&mut *tx)
                .await?;
        }
        sqlx::query("UPDATE cloud_sync_config SET api_url=?,workspace_id=?,device_id=?,owner_uid=?,enabled=0,blocked_code=NULL,retry_at=NULL,retry_attempt=0 WHERE singleton=1").bind(url).bind(workspace).bind(device).bind(owner_uid).execute(&mut *tx).await?;
        tx.commit().await
    }
    pub(crate) async fn set_enabled(&self, enabled: bool) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE cloud_sync_config SET enabled=?,blocked_code=NULL,retry_at=NULL,retry_attempt=0 WHERE singleton=1").bind(enabled).execute(&self.pool).await?;
        Ok(())
    }
    pub(crate) async fn pending(&self) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM cloud_sync_scopes WHERE revision>acknowledged_revision",
        )
        .fetch_one(&self.pool)
        .await
    }
    pub(crate) async fn ready(&self) -> Result<bool, sqlx::Error> {
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM cloud_sync_scopes WHERE revision>acknowledged_revision AND changed_at<=unixepoch()-2)").fetch_one(&self.pool).await
    }
    pub(crate) async fn preview(&self) -> Result<UploadPreview, sqlx::Error> {
        let row=sqlx::query("SELECT (SELECT COUNT(*) FROM projects) AS projects,(SELECT COUNT(*) FROM environments) AS environments,(SELECT COUNT(*) FROM environment_key_definitions) AS keys,(SELECT COUNT(*) FROM environment_key_rules) AS rules,(SELECT COUNT(*) FROM validation_issues) AS issues,(SELECT COUNT(*) FROM agent_accounts) AS agent_accounts,(SELECT COUNT(*) FROM agent_quota_windows) AS quotas").fetch_one(&self.pool).await?;
        Ok(UploadPreview {
            projects: row.get("projects"),
            environments: row.get("environments"),
            keys: row.get("keys"),
            rules: row.get("rules"),
            issues: row.get("issues"),
            agent_accounts: row.get("agent_accounts"),
            quotas: row.get("quotas"),
        })
    }
    pub(crate) async fn prepare_next(&self) -> Result<Option<PreparedUpload>, sqlx::Error> {
        if let Some(row) =
            sqlx::query("SELECT manifest,chunks FROM cloud_sync_uploads ORDER BY rowid LIMIT 1")
                .fetch_optional(&self.pool)
                .await?
        {
            return Ok(Some(PreparedUpload {
                manifest: serde_json::from_str(row.get::<&str, _>("manifest")).map_err(decode)?,
                chunks: serde_json::from_str(row.get::<&str, _>("chunks")).map_err(decode)?,
            }));
        }
        let config = self.config().await?;
        let mut tx = self.pool.begin().await?;
        let Some(row)=sqlx::query("SELECT scope_kind,scope_id,revision FROM cloud_sync_scopes WHERE revision>acknowledged_revision ORDER BY changed_at,scope_kind,scope_id LIMIT 1").fetch_optional(&mut *tx).await? else {return Ok(None);};
        let kind: String = row.get("scope_kind");
        let id: String = row.get("scope_id");
        let revision: i64 = row.get("revision");
        let mut records = if kind == "project" {
            projects::cloud_records(&mut tx, &id).await?
        } else {
            agent_usage::cloud_records(&mut tx, &id).await?
        };
        let tombstone = records.is_empty();
        if kind == "project" && !tombstone {
            records.extend(environment_tracker::cloud_records(&mut tx, &id).await?);
            records.extend(validation_center::cloud_records(&mut tx, &id).await?);
        }
        let chunks = pack_records(records)?;
        if chunks.len() > 20_000 {
            return Err(sqlx::Error::Protocol(
                "Cloud snapshot exceeds upload limit".into(),
            ));
        }
        let manifest = SnapshotManifest {
            protocol_version: 1,
            snapshot_id: Uuid::new_v4().to_string(),
            stream_id: config
                .stream_id
                .ok_or_else(|| sqlx::Error::Protocol("Cloud publisher is not configured".into()))?,
            device_id: config
                .device_id
                .ok_or_else(|| sqlx::Error::Protocol("Cloud publisher is not configured".into()))?,
            scope_kind: kind,
            scope_id: id,
            revision,
            observed_at: Utc::now().to_rfc3339(),
            tombstone,
            chunks: chunks
                .iter()
                .map(|chunk| {
                    let count = serde_json::from_str::<serde_json::Value>(chunk).map_err(decode)?
                        ["records"]
                        .as_array()
                        .map_or(0, Vec::len);
                    Ok(ChunkManifest {
                        hash: digest(chunk),
                        record_count: count,
                    })
                })
                .collect::<Result<Vec<_>, sqlx::Error>>()?,
        };
        let manifest_json = serde_json::to_string(&manifest).map_err(decode)?;
        if manifest_json.len() > 2_000_000 {
            return Err(sqlx::Error::Protocol(
                "Cloud snapshot manifest exceeds upload limit".into(),
            ));
        }
        sqlx::query("INSERT INTO cloud_sync_uploads(snapshot_id,scope_kind,scope_id,revision,manifest,chunks) VALUES(?,?,?,?,?,?)").bind(&manifest.snapshot_id).bind(&manifest.scope_kind).bind(&manifest.scope_id).bind(revision).bind(manifest_json).bind(serde_json::to_string(&chunks).map_err(decode)?).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(Some(PreparedUpload { manifest, chunks }))
    }
    pub(crate) async fn acknowledge(
        &self,
        upload: &PreparedUpload,
        received_at: &str,
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("UPDATE cloud_sync_scopes SET acknowledged_revision=MAX(acknowledged_revision,?),acknowledged_snapshot_id=? WHERE scope_kind=? AND scope_id=?").bind(upload.manifest.revision).bind(&upload.manifest.snapshot_id).bind(&upload.manifest.scope_kind).bind(&upload.manifest.scope_id).execute(&mut *tx).await?;
        sqlx::query("DELETE FROM cloud_sync_uploads WHERE snapshot_id=?")
            .bind(&upload.manifest.snapshot_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE cloud_sync_config SET last_successful_at=?,blocked_code=NULL,retry_at=NULL,retry_attempt=0 WHERE singleton=1").bind(received_at).execute(&mut *tx).await?;
        tx.commit().await
    }
    pub(crate) async fn failure(
        &self,
        code: &str,
        retry_seconds: Option<i64>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE cloud_sync_config SET blocked_code=?,retry_at=?,retry_attempt=retry_attempt+1 WHERE singleton=1").bind(code).bind(retry_seconds.map(|delay|Utc::now().timestamp()+delay)).execute(&self.pool).await?;
        Ok(())
    }
    pub(crate) async fn revisions(
        &self,
    ) -> Result<Vec<(String, String, i64, Option<String>, Option<String>)>, sqlx::Error> {
        sqlx::query_as("SELECT s.scope_kind,s.scope_id,s.revision,s.acknowledged_snapshot_id,u.snapshot_id FROM cloud_sync_scopes s LEFT JOIN cloud_sync_uploads u ON u.scope_kind=s.scope_kind AND u.scope_id=s.scope_id")
            .fetch_all(&self.pool)
            .await
    }
    pub(crate) async fn discard_expired(&self) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("UPDATE cloud_sync_scopes SET revision=revision+1 WHERE EXISTS (SELECT 1 FROM cloud_sync_uploads u WHERE u.scope_kind=cloud_sync_scopes.scope_kind AND u.scope_id=cloud_sync_scopes.scope_id)").execute(&mut *tx).await?;
        sqlx::query("DELETE FROM cloud_sync_uploads")
            .execute(&mut *tx)
            .await?;
        tx.commit().await
    }
    pub(crate) async fn rebuild(&self, stream_id: &str) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM cloud_sync_uploads")
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "UPDATE cloud_sync_scopes SET acknowledged_revision=0,acknowledged_snapshot_id=NULL",
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query("UPDATE cloud_sync_config SET stream_id=?,blocked_code=NULL,retry_at=NULL,retry_attempt=0 WHERE singleton=1").bind(stream_id).execute(&mut *tx).await?;
        tx.commit().await
    }
}
fn decode(error: serde_json::Error) -> sqlx::Error {
    sqlx::Error::Decode(Box::new(error))
}
