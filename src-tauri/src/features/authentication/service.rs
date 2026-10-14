use super::{
    config::FirebaseConfig,
    credentials::{NativeSessionStore, SessionStore},
    model::{Account, AuthSession, Authorization, Login, SavedSession},
    transport::{FirebaseClient, Tokens},
    AuthError,
};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use tokio::sync::Mutex;
use zeroize::Zeroizing;

#[derive(Default)]
struct State {
    loaded: bool,
    login: Option<Login>,
}
#[derive(Clone)]
pub(crate) struct AuthService {
    config: Option<FirebaseConfig>,
    client: Option<FirebaseClient>,
    store: Arc<dyn SessionStore>,
    state: Arc<Mutex<State>>,
    generation: Arc<AtomicU64>,
}
impl std::fmt::Debug for AuthService {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AuthService")
            .finish_non_exhaustive()
    }
}
impl AuthService {
    pub(crate) fn new() -> Self {
        let config = FirebaseConfig::bundled();
        let identity = config
            .as_ref()
            .map(|value| value.project_id.clone())
            .unwrap_or_default();
        Self {
            config,
            client: FirebaseClient::new().ok(),
            store: Arc::new(NativeSessionStore { identity }),
            state: Arc::new(Mutex::new(State::default())),
            generation: Arc::new(AtomicU64::new(0)),
        }
    }
    #[cfg(test)]
    pub(crate) fn with_parts(
        config: FirebaseConfig,
        client: FirebaseClient,
        store: Arc<dyn SessionStore>,
    ) -> Self {
        Self {
            config: Some(config),
            client: Some(client),
            store,
            state: Arc::new(Mutex::new(State::default())),
            generation: Arc::new(AtomicU64::new(0)),
        }
    }
    pub(crate) fn worker_url(&self) -> Result<&str, AuthError> {
        Ok(&self
            .config
            .as_ref()
            .ok_or(AuthError::Configuration)?
            .worker_url)
    }
    pub(crate) fn generation(&self) -> u64 {
        self.generation.load(Ordering::Acquire)
    }
    fn parts(&self) -> Result<(&FirebaseConfig, &FirebaseClient), AuthError> {
        Ok((
            self.config.as_ref().ok_or(AuthError::Configuration)?,
            self.client.as_ref().ok_or(AuthError::Configuration)?,
        ))
    }
    async fn load(&self, state: &mut State) -> Result<(), AuthError> {
        if state.loaded {
            return Ok(());
        }
        let store = self.store.clone();
        let value = tokio::task::spawn_blocking(move || store.load())
            .await
            .map_err(|_| AuthError::CredentialUnavailable)??;
        if let Some(value) = value {
            let mut saved: SavedSession =
                serde_json::from_str(&value).map_err(|_| AuthError::CredentialUnavailable)?;
            if saved.account.user_id.is_empty()
                || saved.account.user_id.len() > 128
                || saved.account.email.len() > 320
                || saved.refresh_token.is_empty()
                || saved.refresh_token.len() > 2048
            {
                return Err(AuthError::CredentialUnavailable);
            }
            state.login = Some(Login {
                account: saved.account.clone(),
                refresh_token: Zeroizing::new(std::mem::take(&mut saved.refresh_token)),
                id_token: Zeroizing::new(String::new()),
                expires_at: 0,
            });
        }
        state.loaded = true;
        Ok(())
    }
    async fn save(&self, login: &Login) -> Result<(), AuthError> {
        let saved = SavedSession {
            account: login.account.clone(),
            refresh_token: login.refresh_token.to_string(),
        };
        let value =
            Zeroizing::new(serde_json::to_string(&saved).map_err(|_| AuthError::InvalidResponse)?);
        let store = self.store.clone();
        tokio::task::spawn_blocking(move || store.save(&value))
            .await
            .map_err(|_| AuthError::CredentialUnavailable)?
    }
    fn public(&self, state: &State) -> AuthSession {
        let account = state.login.as_ref().map(|login| login.account.clone());
        let status = if self.config.is_none() {
            "notConfigured"
        } else if let Some(account) = &account {
            if account.email_verified {
                "signedIn"
            } else {
                "verificationRequired"
            }
        } else {
            "signedOut"
        };
        AuthSession {
            configured: self.config.is_some() && self.client.is_some(),
            state: status.into(),
            account,
        }
    }
    pub(crate) async fn session(&self) -> Result<AuthSession, AuthError> {
        let mut state = self.state.lock().await;
        if self.config.is_some() {
            self.load(&mut state).await?;
        }
        Ok(self.public(&state))
    }
    pub(crate) async fn sign_in(
        &self,
        email: String,
        password: String,
        sign_up: bool,
    ) -> Result<AuthSession, AuthError> {
        let password = Zeroizing::new(password);
        let email = email.trim();
        if email.len() > 320 || !email.contains('@') || password.is_empty() || password.len() > 1024
        {
            return Err(AuthError::InvalidInput);
        }
        let (config, client) = self.parts()?;
        let mut state = self.state.lock().await;
        self.generation.fetch_add(1, Ordering::AcqRel);
        let tokens: Tokens = client.post(config, if sign_up { "signUp" } else { "signInWithPassword" }, serde_json::json!({"email":email,"password":password.as_str(),"returnSecureToken":true})).await?;
        let login = self.login(tokens, None).await?;
        self.save(&login).await?;
        state.login = Some(login);
        state.loaded = true;
        Ok(self.public(&state))
    }
    fn validate_tokens(tokens: &Tokens, expected: Option<&str>) -> Result<i64, AuthError> {
        if tokens.local_id.is_empty()
            || tokens.local_id.len() > 128
            || expected.is_some_and(|uid| uid != tokens.local_id)
            || tokens.id_token.is_empty()
            || tokens.id_token.len() > 8192
            || tokens.refresh_token.is_empty()
            || tokens.refresh_token.len() > 2048
        {
            return Err(AuthError::InvalidResponse);
        }
        tokens
            .expires_in
            .parse::<i64>()
            .ok()
            .filter(|value| *value > 0 && *value <= 86400)
            .ok_or(AuthError::InvalidResponse)
    }
    async fn login(&self, tokens: Tokens, expected: Option<&str>) -> Result<Login, AuthError> {
        let duration = Self::validate_tokens(&tokens, expected)?;
        let (config, client) = self.parts()?;
        let account = client
            .profile(config, &tokens.id_token, &tokens.local_id)
            .await?;
        Ok(Login {
            account,
            refresh_token: Zeroizing::new(tokens.refresh_token),
            id_token: Zeroizing::new(tokens.id_token),
            expires_at: chrono::Utc::now().timestamp() + duration,
        })
    }
    async fn refresh_locked(&self, state: &mut State, force: bool) -> Result<(), AuthError> {
        self.load(state).await?;
        let login = state.login.as_ref().ok_or(AuthError::SessionExpired)?;
        if !force
            && !login.id_token.is_empty()
            && login.expires_at > chrono::Utc::now().timestamp() + 60
        {
            return Ok(());
        }
        let uid = login.account.user_id.clone();
        let (config, client) = self.parts()?;
        let tokens = match client.refresh(config, &login.refresh_token).await {
            Ok(tokens) => tokens,
            Err(AuthError::SessionExpired) => {
                state.login = None;
                self.generation.fetch_add(1, Ordering::AcqRel);
                let store = self.store.clone();
                tokio::task::spawn_blocking(move || store.delete())
                    .await
                    .map_err(|_| AuthError::CredentialUnavailable)??;
                return Err(AuthError::SessionExpired);
            }
            Err(error) => return Err(error),
        };
        let duration = Self::validate_tokens(&tokens, Some(&uid))?;
        let account = state
            .login
            .as_ref()
            .ok_or(AuthError::SessionExpired)?
            .account
            .clone();
        // Persist rotation before a second network request. A failed lookup must not strand
        // the session on the old refresh token. expires_at=0 blocks reuse until verified.
        state.login = Some(Login {
            account,
            refresh_token: Zeroizing::new(tokens.refresh_token),
            id_token: Zeroizing::new(tokens.id_token),
            expires_at: 0,
        });
        self.save(state.login.as_ref().ok_or(AuthError::SessionExpired)?)
            .await?;
        let current = state.login.as_ref().ok_or(AuthError::SessionExpired)?;
        let account = client.profile(config, &current.id_token, &uid).await?;
        let current = state.login.as_mut().ok_or(AuthError::SessionExpired)?;
        current.account = account;
        self.save(current).await?;
        current.expires_at = chrono::Utc::now().timestamp() + duration;
        Ok(())
    }
    pub(crate) async fn refresh_session(&self) -> Result<AuthSession, AuthError> {
        let mut state = self.state.lock().await;
        self.refresh_locked(&mut state, true).await?;
        Ok(self.public(&state))
    }
    pub(crate) async fn authorization_for(
        &self,
        expected_uid: &str,
    ) -> Result<Authorization, AuthError> {
        let mut state = self.state.lock().await;
        self.load(&mut state).await?;
        if state.login.is_none() {
            return Err(AuthError::SessionExpired);
        }
        if state
            .login
            .as_ref()
            .is_some_and(|login| login.account.user_id != expected_uid)
        {
            return Err(AuthError::AccountMismatch);
        }
        if !state
            .login
            .as_ref()
            .is_some_and(|login| login.account.email_verified)
        {
            return Err(AuthError::VerificationRequired);
        }
        self.refresh_locked(&mut state, false).await?;
        let login = state.login.as_ref().ok_or(AuthError::SessionExpired)?;
        if !login.account.email_verified {
            return Err(AuthError::VerificationRequired);
        }
        Ok(Authorization {
            token: Zeroizing::new(login.id_token.to_string()),
            generation: self.generation(),
        })
    }
    pub(crate) async fn current_account(&self) -> Result<Account, AuthError> {
        self.session()
            .await?
            .account
            .ok_or(AuthError::SessionExpired)
    }
    pub(crate) async fn send_verification(&self) -> Result<(), AuthError> {
        let mut state = self.state.lock().await;
        self.refresh_locked(&mut state, false).await?;
        let (config, client) = self.parts()?;
        let token = &state
            .login
            .as_ref()
            .ok_or(AuthError::SessionExpired)?
            .id_token;
        let _: serde_json::Value = client
            .post(
                config,
                "sendOobCode",
                serde_json::json!({"requestType":"VERIFY_EMAIL","idToken":token.as_str()}),
            )
            .await?;
        Ok(())
    }
    pub(crate) async fn reset_password(&self, email: &str) -> Result<(), AuthError> {
        if email.len() > 320 || !email.contains('@') {
            return Err(AuthError::InvalidInput);
        }
        let (config, client) = self.parts()?;
        let result: Result<serde_json::Value, AuthError> = client
            .post(
                config,
                "sendOobCode",
                serde_json::json!({"requestType":"PASSWORD_RESET","email":email.trim()}),
            )
            .await;
        match result {
            Ok(_) | Err(AuthError::InvalidCredentials) => Ok(()),
            Err(error) => Err(error),
        }
    }
    pub(crate) async fn sign_out(&self) -> Result<(), AuthError> {
        self.generation.fetch_add(1, Ordering::AcqRel);
        let mut state = self.state.lock().await;
        state.login = None;
        state.loaded = true;
        let store = self.store.clone();
        tokio::task::spawn_blocking(move || store.delete())
            .await
            .map_err(|_| AuthError::CredentialUnavailable)?
    }
}
