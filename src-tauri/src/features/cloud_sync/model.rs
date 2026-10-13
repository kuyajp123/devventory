use crate::shared::cloud::CloudRecord;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub(crate) const PROTOCOL_VERSION: u32 = 1;
pub(crate) const MAX_BODY_BYTES: usize = 65_536;
pub(crate) fn digest(value: &str) -> String {
    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ChunkManifest {
    pub(crate) hash: String,
    pub(crate) record_count: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SnapshotManifest {
    pub(crate) protocol_version: u32,
    pub(crate) snapshot_id: String,
    pub(crate) stream_id: String,
    pub(crate) device_id: String,
    pub(crate) scope_kind: String,
    pub(crate) scope_id: String,
    pub(crate) revision: i64,
    pub(crate) observed_at: String,
    pub(crate) tombstone: bool,
    pub(crate) chunks: Vec<ChunkManifest>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct PreparedUpload {
    pub(crate) manifest: SnapshotManifest,
    pub(crate) chunks: Vec<String>,
}

pub(crate) fn pack_records(records: Vec<CloudRecord>) -> Result<Vec<String>, sqlx::Error> {
    let mut chunks = Vec::new();
    let mut batch = Vec::new();
    let mut size = 14;
    for record in records {
        let encoded =
            serde_json::to_string(&record).map_err(|error| sqlx::Error::Encode(Box::new(error)))?;
        if encoded.len() + 14 > MAX_BODY_BYTES {
            return Err(sqlx::Error::Protocol(
                "Cloud metadata record exceeds upload limit".into(),
            ));
        }
        if batch.len() == 25 || size + encoded.len() + 1 > MAX_BODY_BYTES {
            chunks.push(format!("{{\"records\":[{}]}}", batch.join(",")));
            batch.clear();
            size = 14;
        }
        size += encoded.len() + 1;
        batch.push(encoded);
    }
    if !batch.is_empty() {
        chunks.push(format!("{{\"records\":[{}]}}", batch.join(",")));
    }
    Ok(chunks)
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub(crate) struct SyncConfig {
    pub(crate) enabled: bool,
    pub(crate) api_url: String,
    pub(crate) workspace_id: Option<String>,
    pub(crate) device_id: Option<String>,
    pub(crate) stream_id: Option<String>,
    pub(crate) last_successful_at: Option<String>,
    pub(crate) blocked_code: Option<String>,
    pub(crate) retry_at: Option<i64>,
    pub(crate) retry_attempt: i64,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UploadPreview {
    pub(crate) projects: i64,
    pub(crate) environments: i64,
    pub(crate) keys: i64,
    pub(crate) rules: i64,
    pub(crate) issues: i64,
    pub(crate) agent_accounts: i64,
    pub(crate) quotas: i64,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncStatus {
    pub(crate) enabled: bool,
    pub(crate) configured: bool,
    pub(crate) api_url: String,
    pub(crate) workspace_id: Option<String>,
    pub(crate) device_id: Option<String>,
    pub(crate) state: String,
    pub(crate) pending_scopes: i64,
    pub(crate) last_successful_at: Option<String>,
    pub(crate) problem: Option<String>,
    pub(crate) preview: UploadPreview,
}
