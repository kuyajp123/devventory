use super::model::{PreparedUpload, SyncConfig, PROTOCOL_VERSION};
use reqwest::{Client, Method, Url};
use serde::{de::DeserializeOwned, Deserialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub(crate) enum SyncError {
    #[error("Synchronization was paused")]
    Cancelled,
    #[error("The prepared cloud snapshot expired")]
    SnapshotExpired,
    #[error("Cloud connection settings are invalid")]
    InvalidConfiguration,
    #[error("The publisher credential is unavailable")]
    CredentialUnavailable,
    #[error("Local synchronization storage is unavailable")]
    Storage(#[from] sqlx::Error),
    #[error("The cloud service is unreachable")]
    Offline,
    #[error("The publisher credential was rejected")]
    Unauthorized,
    #[error("Cloud synchronization needs recovery")]
    RecoveryRequired,
    #[error("The cloud service rejected metadata")]
    InvalidPayload,
    #[error("The cloud response is invalid")]
    InvalidResponse,
    #[error("Cloud requests are temporarily limited")]
    RateLimited(i64),
}
impl SyncError {
    pub(crate) fn code(&self) -> &'static str {
        match self {
            Self::Cancelled => "CANCELLED",
            Self::SnapshotExpired => "SNAPSHOT_EXPIRED",
            Self::InvalidConfiguration => "INVALID_CONFIGURATION",
            Self::CredentialUnavailable => "CREDENTIAL_UNAVAILABLE",
            Self::Storage(_) => "LOCAL_STORAGE_UNAVAILABLE",
            Self::Offline => "OFFLINE",
            Self::Unauthorized => "UNAUTHORIZED",
            Self::RecoveryRequired => "RECOVERY_REQUIRED",
            Self::InvalidPayload => "INVALID_PAYLOAD",
            Self::InvalidResponse => "INVALID_RESPONSE",
            Self::RateLimited(_) => "RATE_LIMITED",
        }
    }
    pub(crate) fn transient(&self) -> bool {
        matches!(
            self,
            Self::Offline | Self::Storage(_) | Self::RateLimited(_)
        )
    }
}
pub(crate) fn validate_url(input: &str) -> Result<String, SyncError> {
    let url = Url::parse(input.trim()).map_err(|_| SyncError::InvalidConfiguration)?;
    let host = url.host_str().ok_or(SyncError::InvalidConfiguration)?;
    let production =
        url.scheme() == "https" && host.ends_with(".workers.dev") && url.port().is_none();
    let development = cfg!(debug_assertions)
        && url.scheme() == "http"
        && matches!(host, "localhost" | "127.0.0.1" | "[::1]");
    if (!production && !development)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        return Err(SyncError::InvalidConfiguration);
    }
    Ok(url.as_str().trim_end_matches('/').to_owned())
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Head {
    pub(crate) scope_kind: String,
    pub(crate) scope_id: String,
    pub(crate) revision: i64,
    pub(crate) snapshot_id: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RemoteStatus {
    pub(crate) protocol_version: u32,
    pub(crate) workspace_id: String,
    pub(crate) device_id: String,
    pub(crate) stream_id: Option<String>,
    pub(crate) heads: Vec<Head>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Acknowledgement {
    pub(crate) protocol_version: u32,
    pub(crate) snapshot_id: String,
    pub(crate) stream_id: String,
    pub(crate) scope_kind: String,
    pub(crate) scope_id: String,
    pub(crate) revision: i64,
    pub(crate) received_at: String,
}
pub(crate) struct Transport {
    client: Client,
    url: String,
}
impl Transport {
    pub(crate) fn new(config: &SyncConfig) -> Result<Self, SyncError> {
        let url = validate_url(&config.api_url)?;
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(5))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| SyncError::Offline)?;
        Ok(Self { client, url })
    }
    pub(crate) async fn request<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        token: &str,
        body: Option<String>,
    ) -> Result<T, SyncError> {
        let mut request = self
            .client
            .request(method, format!("{}{path}", self.url))
            .bearer_auth(token)
            .header("Content-Type", "application/json");
        if let Some(body) = body {
            request = request.body(body);
        }
        let mut response = request.send().await.map_err(|_| SyncError::Offline)?;
        if !response.status().is_success() {
            return Err(match response.status().as_u16() {
                401 | 403 => SyncError::Unauthorized,
                409 => SyncError::RecoveryRequired,
                410 => SyncError::SnapshotExpired,
                400 | 413 | 415 | 422 => SyncError::InvalidPayload,
                429 => SyncError::RateLimited(
                    response
                        .headers()
                        .get("Retry-After")
                        .and_then(|value| value.to_str().ok())
                        .and_then(|value| value.parse().ok())
                        .unwrap_or(60),
                ),
                _ => SyncError::Offline,
            });
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| SyncError::Offline)? {
            if bytes.len() + chunk.len() > 2_000_000 {
                return Err(SyncError::InvalidResponse);
            }
            bytes.extend_from_slice(&chunk);
        }
        serde_json::from_slice(&bytes).map_err(|_| SyncError::InvalidResponse)
    }
    pub(crate) async fn status(
        &self,
        config: &SyncConfig,
        token: &str,
    ) -> Result<RemoteStatus, SyncError> {
        let status: RemoteStatus = self
            .request(Method::GET, "/v1/sync/status", token, None)
            .await?;
        if status.protocol_version != PROTOCOL_VERSION
            || Some(&status.workspace_id) != config.workspace_id.as_ref()
            || Some(&status.device_id) != config.device_id.as_ref()
        {
            return Err(SyncError::InvalidResponse);
        }
        Ok(status)
    }
    pub(crate) async fn publish(
        &self,
        upload: &PreparedUpload,
        token: &str,
        cancel: &AtomicBool,
    ) -> Result<String, SyncError> {
        if cancel.load(Ordering::Acquire) {
            return Err(SyncError::Cancelled);
        }
        let begin: serde_json::Value = self
            .request(
                Method::POST,
                "/v1/sync/snapshots",
                token,
                Some(
                    serde_json::to_string(&upload.manifest)
                        .map_err(|_| SyncError::InvalidPayload)?,
                ),
            )
            .await?;
        if begin["protocolVersion"] != 1 || begin["snapshotId"] != upload.manifest.snapshot_id {
            return Err(SyncError::InvalidResponse);
        }
        let uploaded = begin["uploadedChunks"]
            .as_u64()
            .ok_or(SyncError::InvalidResponse)? as usize;
        if uploaded > upload.chunks.len() {
            return Err(SyncError::InvalidResponse);
        }
        for (index, chunk) in upload.chunks.iter().enumerate().skip(uploaded) {
            if cancel.load(Ordering::Acquire) {
                return Err(SyncError::Cancelled);
            }
            let receipt: serde_json::Value = self
                .request(
                    Method::PUT,
                    &format!(
                        "/v1/sync/snapshots/{}/chunks/{index}",
                        upload.manifest.snapshot_id
                    ),
                    token,
                    Some(chunk.clone()),
                )
                .await?;
            if receipt["protocolVersion"] != 1
                || receipt["snapshotId"] != upload.manifest.snapshot_id
                || receipt["chunkIndex"] != index
            {
                return Err(SyncError::InvalidResponse);
            }
        }
        if cancel.load(Ordering::Acquire) {
            return Err(SyncError::Cancelled);
        }
        let ack: Acknowledgement = self
            .request(
                Method::POST,
                &format!(
                    "/v1/sync/snapshots/{}/activate",
                    upload.manifest.snapshot_id
                ),
                token,
                Some("{}".into()),
            )
            .await?;
        if ack.protocol_version != 1
            || ack.snapshot_id != upload.manifest.snapshot_id
            || ack.stream_id != upload.manifest.stream_id
            || ack.scope_kind != upload.manifest.scope_kind
            || ack.scope_id != upload.manifest.scope_id
            || ack.revision != upload.manifest.revision
            || chrono::DateTime::parse_from_rfc3339(&ack.received_at).is_err()
        {
            return Err(SyncError::InvalidResponse);
        }
        Ok(ack.received_at)
    }
}
