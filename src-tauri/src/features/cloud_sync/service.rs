use super::{
    credentials::{Credentials, NativeCredentials},
    model::{SyncConfig, SyncStatus},
    repository::SyncRepository,
    transport::{validate_url, SyncError, Transport},
};
use crate::features::authentication::{AuthError, AuthService};
use chrono::Utc;
use serde::Deserialize;
use sqlx::SqlitePool;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
};
use std::time::Duration;
use tokio::sync::{Mutex, Notify};
use zeroize::Zeroizing;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfigureSync {
    pub(crate) api_url: String,
    pub(crate) workspace_id: String,
    pub(crate) device_id: String,
    pub(crate) publisher_token: Option<String>,
}
#[derive(Clone)]
pub(crate) struct CloudSyncService {
    repository: SyncRepository,
    credentials: Arc<dyn Credentials>,
    gate: Arc<Mutex<()>>,
    active: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
    authentication_epoch: Arc<AtomicU64>,
    approved_authentication_epoch: Arc<AtomicU64>,
    wake: Arc<Notify>,
    started: Arc<AtomicBool>,
    shutdown: Arc<Notify>,
    authentication: Option<AuthService>,
}
impl std::fmt::Debug for CloudSyncService {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("CloudSyncService")
            .finish_non_exhaustive()
    }
}
struct ActiveGuard(Arc<AtomicBool>);
impl Drop for ActiveGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl CloudSyncService {
    pub(crate) fn new(pool: SqlitePool, authentication: AuthService) -> Self {
        let mut service = Self::with_credentials(pool, Arc::new(NativeCredentials));
        service.authentication = Some(authentication);
        service
    }
    pub(crate) fn with_credentials(pool: SqlitePool, credentials: Arc<dyn Credentials>) -> Self {
        Self {
            repository: SyncRepository::new(pool),
            credentials,
            gate: Arc::new(Mutex::new(())),
            active: Arc::new(AtomicBool::new(false)),
            cancel: Arc::new(AtomicBool::new(false)),
            authentication_epoch: Arc::new(AtomicU64::new(0)),
            approved_authentication_epoch: Arc::new(AtomicU64::new(0)),
            wake: Arc::new(Notify::new()),
            started: Arc::new(AtomicBool::new(false)),
            shutdown: Arc::new(Notify::new()),
            authentication: None,
        }
    }
    pub(crate) fn start(&self) {
        if self.started.swap(true, Ordering::AcqRel) {
            return;
        }
        let service = self.clone();
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(2));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                tokio::select! {_ = interval.tick()=>{},_ = service.wake.notified()=>{},_ = service.shutdown.notified()=>break}
                let _ = service.synchronize(false).await;
            }
        });
    }
    pub(crate) async fn configure(&self, input: ConfigureSync) -> Result<SyncStatus, SyncError> {
        self.cancel.store(true, Ordering::Release);
        let _gate = self.gate.lock().await;
        if self.repository.config().await?.owner_uid.is_some() {
            return Err(SyncError::InvalidConfiguration);
        }
        let url = validate_url(&input.api_url)?;
        let workspace_id = uuid::Uuid::parse_str(&input.workspace_id)
            .map_err(|_| SyncError::InvalidConfiguration)?
            .to_string();
        let device_id = uuid::Uuid::parse_str(&input.device_id)
            .map_err(|_| SyncError::InvalidConfiguration)?
            .to_string();
        let identity = format!("{}|{}:{}", url, workspace_id, device_id);
        if let Some(token) = input.publisher_token.filter(|value| !value.is_empty()) {
            let token = Zeroizing::new(token);
            if token.len() != 64
                || !token
                    .chars()
                    .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
            {
                return Err(SyncError::InvalidConfiguration);
            }
            let credentials = self.credentials.clone();
            tokio::task::spawn_blocking(move || credentials.save(&identity, &token))
                .await
                .map_err(|_| SyncError::CredentialUnavailable)?
                .map_err(|_| SyncError::CredentialUnavailable)?;
        } else {
            let credentials = self.credentials.clone();
            tokio::task::spawn_blocking(move || credentials.load(&identity))
                .await
                .map_err(|_| SyncError::CredentialUnavailable)?
                .map_err(|_| SyncError::CredentialUnavailable)?;
        }
        self.repository
            .configure(&url, &workspace_id, &device_id)
            .await?;
        self.status().await
    }
    pub(crate) fn shutdown(&self) {
        self.cancel.store(true, Ordering::Release);
        self.shutdown.notify_one();
    }
    pub(crate) fn cancel_auth_work(&self) {
        // Only explicit enable approves this epoch. Resetting per-upload
        // cancellation or failing to persist a pause cannot resume publishing.
        self.authentication_epoch.fetch_add(1, Ordering::AcqRel);
        self.cancel.store(true, Ordering::Release);
    }
    fn authentication_paused(&self) -> bool {
        self.authentication_epoch.load(Ordering::Acquire)
            != self.approved_authentication_epoch.load(Ordering::Acquire)
    }
    pub(crate) async fn authentication_changed(&self) -> Result<(), SyncError> {
        self.cancel_auth_work();
        let _gate = self.gate.lock().await;
        let config = self.repository.config().await?;
        if config.owner_uid.is_none() {
            // Sign-in cannot leave an unclaimed private-token connection publishing in the background.
            self.repository.set_enabled(false).await?;
        } else if config
            .blocked_code
            .as_deref()
            .is_some_and(|code| code.starts_with("AUTH_"))
        {
            self.repository.set_enabled(config.enabled).await?;
        }
        self.wake.notify_one();
        Ok(())
    }
    pub(crate) async fn pause_for_sign_out(&self) -> Result<(), SyncError> {
        self.cancel_auth_work();
        self.repository.set_enabled(false).await?;
        Ok(())
    }
    async fn authorization(
        &self,
        config: &SyncConfig,
    ) -> Result<(Transport, Zeroizing<String>, Option<u64>), SyncError> {
        let credential = self.token(config).await?;
        let transport = Transport::new(config)?;
        if let Some(uid) = config.owner_uid.as_deref() {
            let auth = self
                .authentication
                .as_ref()
                .ok_or(AuthError::SessionExpired)?
                .authorization_for(uid)
                .await?;
            Ok((
                transport.with_device(credential),
                auth.token,
                Some(auth.generation),
            ))
        } else {
            // Also fail closed after a restart if a legacy pause never reached SQLite.
            if let Some(authentication) = &self.authentication {
                authentication.authorize_legacy_publishing().await?;
            }
            Ok((transport, credential, None))
        }
    }
    fn check_generation(&self, generation: Option<u64>) -> Result<(), SyncError> {
        if self.authentication_paused()
            || self.cancel.load(Ordering::Acquire)
            || generation.is_some_and(|value| {
                self.authentication
                    .as_ref()
                    .is_none_or(|auth| auth.generation() != value)
            })
        {
            return Err(SyncError::Cancelled);
        }
        Ok(())
    }
    pub(crate) async fn connect_account(
        &self,
        confirmation: &str,
        claim_legacy: bool,
        replace_publisher: bool,
    ) -> Result<SyncStatus, SyncError> {
        if confirmation != "link this local database" {
            return Err(SyncError::InvalidConfiguration);
        }
        self.cancel_auth_work();
        let _gate = self.gate.lock().await;
        let authentication = self
            .authentication
            .as_ref()
            .ok_or(AuthError::Configuration)?;
        let account = authentication.current_account().await?;
        let auth = authentication.authorization_for(&account.user_id).await?;
        let mut config = self.repository.config().await?;
        let legacy = config.workspace_id.is_some() && config.owner_uid.is_none();
        if legacy && !claim_legacy {
            return Err(SyncError::LegacyClaimRequired);
        }
        let url = validate_url(authentication.worker_url()?)?;
        if legacy && validate_url(&config.api_url)? != url {
            return Err(SyncError::InvalidConfiguration);
        }
        config.api_url = url.clone();
        let registration_id = self.repository.registration_id(&account.user_id).await?;
        let transport = Transport::new(&config)?;
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        struct Receipt {
            protocol_version: u32,
            workspace_id: String,
            device_id: String,
            device_token: String,
        }
        let receipt: Receipt = if legacy {
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "camelCase", deny_unknown_fields)]
            struct ExistingWorkspace {
                protocol_version: u32,
                workspace_id: Option<String>,
                device_id: Option<String>,
            }
            let owned: ExistingWorkspace = transport
                .request(reqwest::Method::GET, "/v1/workspaces", &auth.token, None)
                .await?;
            if owned.protocol_version != 1 {
                return Err(SyncError::InvalidResponse);
            }
            if owned.workspace_id == config.workspace_id && owned.device_id == config.device_id {
                // A matching registration ID alone is not recovery proof. Attach
                // the native device credential when a previous receipt was saved.
                let mut transport = transport;
                if let Ok(proof) = self.token(&config).await {
                    transport = transport.with_device(proof);
                }
                let mut input = serde_json::json!({"registrationId":registration_id});
                if replace_publisher {
                    input["replaceConfirmed"] = true.into();
                    input["expectedDeviceId"] = owned.device_id.into();
                }
                transport
                    .request(
                        reqwest::Method::POST,
                        "/v1/devices",
                        &auth.token,
                        Some(input.to_string()),
                    )
                    .await?
            } else {
                transport
                    .with_legacy_proof(self.token(&config).await?)
                    .request(
                        reqwest::Method::POST,
                        "/v1/workspaces/claim",
                        &auth.token,
                        Some(
                            serde_json::json!({"registrationId":registration_id,"confirmed":true})
                                .to_string(),
                        ),
                    )
                    .await?
            }
        } else {
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "camelCase", deny_unknown_fields)]
            struct Workspace {
                protocol_version: u32,
                workspace_id: String,
                device_id: Option<String>,
            }
            let workspace: Workspace = transport
                .request(
                    reqwest::Method::POST,
                    "/v1/workspaces",
                    &auth.token,
                    Some("{}".into()),
                )
                .await?;
            if workspace.protocol_version != 1
                || uuid::Uuid::parse_str(&workspace.workspace_id).is_err()
            {
                return Err(SyncError::InvalidResponse);
            }
            let mut input = serde_json::json!({"registrationId":registration_id});
            if replace_publisher {
                input["replaceConfirmed"] = true.into();
                input["expectedDeviceId"] = workspace.device_id.into();
            }
            let mut transport = transport;
            if config.owner_uid.as_deref() == Some(account.user_id.as_str())
                && config.workspace_id.as_deref() == Some(workspace.workspace_id.as_str())
            {
                // Missing proof deliberately falls back to the Worker's explicit
                // replacement flow; it never grants an automatic recovery token.
                if let Ok(proof) = self.token(&config).await {
                    transport = transport.with_device(proof);
                }
            }
            transport
                .request(
                    reqwest::Method::POST,
                    "/v1/devices",
                    &auth.token,
                    Some(input.to_string()),
                )
                .await?
        };
        if authentication.generation() != auth.generation {
            return Err(SyncError::Cancelled);
        }
        if receipt.protocol_version != 1
            || uuid::Uuid::parse_str(&receipt.workspace_id).is_err()
            || uuid::Uuid::parse_str(&receipt.device_id).is_err()
            || receipt.device_token.len() != 64
            || !receipt
                .device_token
                .bytes()
                .all(|value| value.is_ascii_digit() || (b'a'..=b'f').contains(&value))
        {
            return Err(SyncError::InvalidResponse);
        }
        if legacy
            && (config.workspace_id.as_deref() != Some(&receipt.workspace_id)
                || config.device_id.as_deref() != Some(&receipt.device_id))
        {
            return Err(SyncError::InvalidResponse);
        }
        let token = Zeroizing::new(receipt.device_token);
        let identity = format!("{}|{}:{}", url, receipt.workspace_id, receipt.device_id);
        let credentials = self.credentials.clone();
        tokio::task::spawn_blocking(move || credentials.save(&identity, &token))
            .await
            .map_err(|_| SyncError::CredentialUnavailable)?
            .map_err(|_| SyncError::CredentialUnavailable)?;
        if authentication.generation() != auth.generation {
            return Err(SyncError::Cancelled);
        }
        self.repository
            .configure_owned(
                &url,
                &receipt.workspace_id,
                &receipt.device_id,
                Some(&account.user_id),
            )
            .await?;
        self.status().await
    }
    pub(crate) async fn set_enabled(
        &self,
        enabled: bool,
        confirmed: bool,
    ) -> Result<SyncStatus, SyncError> {
        if !enabled {
            self.cancel_auth_work();
        }
        let _gate = self.gate.lock().await;
        let authentication_epoch = self.authentication_epoch.load(Ordering::Acquire);
        let config = self.repository.config().await?;
        if enabled && (!confirmed || config.workspace_id.is_none()) {
            return Err(SyncError::InvalidConfiguration);
        }
        if enabled {
            if let Some(uid) = config.owner_uid.as_deref() {
                let authentication = self
                    .authentication
                    .as_ref()
                    .ok_or(AuthError::Configuration)?;
                let account = authentication.current_account().await?;
                if account.user_id != uid {
                    return Err(AuthError::AccountMismatch.into());
                }
                if !account.email_verified {
                    return Err(AuthError::VerificationRequired.into());
                }
            } else if let Some(authentication) = &self.authentication {
                authentication.authorize_legacy_publishing().await?;
            }
        }
        self.repository.set_enabled(enabled).await?;
        if enabled {
            self.approved_authentication_epoch
                .store(authentication_epoch, Ordering::Release);
        }
        self.wake.notify_one();
        self.status().await
    }
    pub(crate) async fn status(&self) -> Result<SyncStatus, SyncError> {
        let config = self.repository.config().await?;
        let pending = self.repository.pending().await?;
        let configured = config.workspace_id.is_some() && !config.api_url.is_empty();
        let authentication_paused = self.authentication_paused();
        let enabled = config.enabled && !authentication_paused;
        let problem = if config.enabled && authentication_paused {
            Some("AUTH_PUBLISHING_PAUSED".to_owned())
        } else {
            config.blocked_code
        };
        let state = if !configured {
            "notConfigured"
        } else if !enabled {
            "paused"
        } else if self.active.load(Ordering::Acquire) {
            "syncing"
        } else if let Some(code) = problem.as_deref() {
            match code {
                "OFFLINE" => "offline",
                "RATE_LIMITED" => "retrying",
                "RECOVERY_REQUIRED" => "recoveryRequired",
                _ => "blocked",
            }
        } else if pending > 0 {
            "pending"
        } else if config.last_successful_at.is_none() {
            "ready"
        } else {
            "synced"
        };
        Ok(SyncStatus {
            owner_uid: config.owner_uid,
            enabled,
            configured,
            api_url: config.api_url,
            workspace_id: config.workspace_id,
            device_id: config.device_id,
            state: state.into(),
            pending_scopes: pending,
            last_successful_at: config.last_successful_at,
            problem,
            preview: self.repository.preview().await?,
        })
    }
    async fn token(&self, config: &SyncConfig) -> Result<Zeroizing<String>, SyncError> {
        let identity = format!(
            "{}|{}:{}",
            validate_url(&config.api_url)?,
            config
                .workspace_id
                .as_deref()
                .ok_or(SyncError::InvalidConfiguration)?,
            config
                .device_id
                .as_deref()
                .ok_or(SyncError::InvalidConfiguration)?
        );
        let credentials = self.credentials.clone();
        let token = tokio::task::spawn_blocking(move || credentials.load(&identity))
            .await
            .map_err(|_| SyncError::CredentialUnavailable)?
            .map_err(|_| SyncError::CredentialUnavailable)?;
        if token.len() != 64 {
            return Err(SyncError::CredentialUnavailable);
        }
        Ok(token)
    }
    pub(crate) async fn synchronize(&self, manual: bool) -> Result<(), SyncError> {
        let Ok(_gate) = self.gate.try_lock() else {
            return Ok(());
        };
        if self.authentication_paused() {
            return Err(SyncError::Cancelled);
        }
        self.cancel.store(false, Ordering::Release);
        let config = self.repository.config().await?;
        if !config.enabled || self.repository.pending().await? == 0 {
            return Ok(());
        }
        if !manual {
            if config.blocked_code.is_some() && config.retry_at.is_none() {
                return Ok(());
            }
            if config
                .retry_at
                .is_some_and(|time| time > Utc::now().timestamp())
            {
                return Ok(());
            }
            if !self.repository.ready().await? {
                return Ok(());
            }
        }
        self.active.store(true, Ordering::Release);
        let _active = ActiveGuard(self.active.clone());
        let result = self.publish_next(&config).await;
        if matches!(result, Err(SyncError::SnapshotExpired)) {
            self.repository.discard_expired().await?;
            return Ok(());
        }
        if matches!(result, Err(SyncError::Cancelled)) {
            return result;
        }
        if let Err(error) = &result {
            let jitter = i64::from(uuid::Uuid::new_v4().as_bytes()[0] % 5);
            let retry = if let SyncError::RateLimited(delay) = error {
                Some((*delay).clamp(1, 86400))
            } else if error.transient() {
                Some(
                    (5_i64.saturating_mul(1_i64 << config.retry_attempt.clamp(0, 6))).min(300)
                        + jitter,
                )
            } else {
                None
            };
            self.repository.failure(error.code(), retry).await?;
            tracing::debug!(code = error.code(), "Cloud synchronization deferred");
        }
        result
    }
    async fn publish_next(&self, config: &SyncConfig) -> Result<(), SyncError> {
        let (transport, token, generation) = self.authorization(config).await?;
        self.check_generation(generation)?;
        let remote = transport.status(config, &token).await?;
        if remote.stream_id.is_some() && remote.stream_id != config.stream_id {
            return Err(SyncError::RecoveryRequired);
        }
        let local = self.repository.revisions().await?;
        for head in remote.heads {
            if local
                .iter()
                .find(|(kind, id, _, _, _)| kind == &head.scope_kind && id == &head.scope_id)
                .is_none_or(|(_, _, revision, acknowledged, prepared)| {
                    *revision < head.revision
                        || (acknowledged.as_deref() != Some(&head.snapshot_id)
                            && prepared.as_deref() != Some(&head.snapshot_id))
                })
            {
                return Err(SyncError::RecoveryRequired);
            }
        }
        if let Some(upload) = self.repository.prepare_next().await? {
            self.check_generation(generation)?;
            let received = transport.publish(&upload, &token, &self.cancel).await?;
            self.check_generation(generation)?;
            self.repository.acknowledge(&upload, &received).await?;
        }
        Ok(())
    }
    pub(crate) async fn rebuild(&self, confirmation: &str) -> Result<SyncStatus, SyncError> {
        let _gate = self.gate.lock().await;
        self.cancel.store(false, Ordering::Release);
        if confirmation != "rebuild cloud metadata" {
            return Err(SyncError::InvalidConfiguration);
        }
        let config = self.repository.config().await?;
        let (transport, token, generation) = self.authorization(&config).await?;
        transport.status(&config, &token).await?;
        self.check_generation(generation)?;
        let stream = uuid::Uuid::new_v4().to_string();
        let response: serde_json::Value = transport
            .request(
                reqwest::Method::POST,
                "/v1/sync/rebuild",
                &token,
                Some(serde_json::json!({"confirm":confirmation,"streamId":stream}).to_string()),
            )
            .await?;
        if response["protocolVersion"] != 1 || response["streamId"] != stream {
            return Err(SyncError::InvalidResponse);
        }
        self.check_generation(generation)?;
        self.repository.rebuild(&stream).await?;
        self.wake.notify_one();
        self.status().await
    }
}
