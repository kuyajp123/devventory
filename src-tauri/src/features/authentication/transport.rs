use super::{config::FirebaseConfig, model::Account, AuthError};
use reqwest::{Client, Response};
use serde::{de::DeserializeOwned, Deserialize};
use std::time::Duration;

#[derive(Clone)]
pub(crate) struct FirebaseClient {
    client: Client,
    identity_url: String,
    refresh_url: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Tokens {
    pub(crate) local_id: String,
    pub(crate) id_token: String,
    pub(crate) refresh_token: String,
    pub(crate) expires_in: String,
}
#[derive(Deserialize)]
struct Refreshed {
    user_id: String,
    project_id: String,
    id_token: String,
    refresh_token: String,
    expires_in: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct User {
    local_id: String,
    email: String,
    #[serde(default)]
    email_verified: bool,
}
#[derive(Deserialize)]
struct Users {
    users: Vec<User>,
}
impl FirebaseClient {
    pub(crate) fn new() -> Result<Self, AuthError> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .connect_timeout(Duration::from_secs(5))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|_| AuthError::Configuration)?,
            identity_url: "https://identitytoolkit.googleapis.com".into(),
            refresh_url: "https://securetoken.googleapis.com".into(),
        })
    }
    #[cfg(test)]
    pub(crate) fn for_test(url: &str) -> Result<Self, AuthError> {
        let mut client = Self::new()?;
        client.identity_url = url.into();
        client.refresh_url = url.into();
        Ok(client)
    }
    async fn response<T: DeserializeOwned>(&self, mut response: Response) -> Result<T, AuthError> {
        let status = response.status();
        let mut bytes = Vec::new();
        while let Some(part) = response.chunk().await.map_err(|_| AuthError::Offline)? {
            if bytes.len() + part.len() > 65_536 {
                return Err(AuthError::InvalidResponse);
            }
            bytes.extend_from_slice(&part);
        }
        if !status.is_success() {
            let error: serde_json::Value = serde_json::from_slice(&bytes).unwrap_or_default();
            let code = error["error"]["message"]
                .as_str()
                .unwrap_or("")
                .split(" : ")
                .next()
                .unwrap_or("");
            return Err(match code {
                "INVALID_LOGIN_CREDENTIALS" | "EMAIL_NOT_FOUND" | "INVALID_PASSWORD" => {
                    AuthError::InvalidCredentials
                }
                "TOO_MANY_ATTEMPTS_TRY_LATER" => AuthError::RateLimited,
                "TOKEN_EXPIRED"
                | "USER_DISABLED"
                | "USER_NOT_FOUND"
                | "INVALID_REFRESH_TOKEN"
                | "INVALID_ID_TOKEN" => AuthError::SessionExpired,
                "OPERATION_NOT_ALLOWED" | "CONFIGURATION_NOT_FOUND" | "PROJECT_NUMBER_MISMATCH" => {
                    AuthError::Configuration
                }
                "EMAIL_EXISTS"
                | "WEAK_PASSWORD"
                | "INVALID_EMAIL"
                | "PASSWORD_DOES_NOT_MEET_REQUIREMENTS" => AuthError::InvalidInput,
                _ if status.as_u16() == 429 => AuthError::RateLimited,
                _ if status.is_server_error() => AuthError::Offline,
                _ => AuthError::InvalidResponse,
            });
        }
        serde_json::from_slice(&bytes).map_err(|_| AuthError::InvalidResponse)
    }
    pub(crate) async fn post<T: DeserializeOwned>(
        &self,
        config: &FirebaseConfig,
        action: &str,
        body: serde_json::Value,
    ) -> Result<T, AuthError> {
        let response = self
            .client
            .post(format!("{}/v1/accounts:{}", self.identity_url, action))
            .query(&[("key", &config.api_key)])
            .json(&body)
            .send()
            .await
            .map_err(|_| AuthError::Offline)?;
        self.response(response).await
    }
    pub(crate) async fn refresh(
        &self,
        config: &FirebaseConfig,
        refresh: &str,
    ) -> Result<Tokens, AuthError> {
        // Firebase's documented sample uses the numeric project number in this field.
        // https://firebase.google.com/docs/reference/rest/auth#section-refresh-token
        let response = self
            .client
            .post(format!("{}/v1/token", self.refresh_url))
            .query(&[("key", &config.api_key)])
            .form(&[("grant_type", "refresh_token"), ("refresh_token", refresh)])
            .send()
            .await
            .map_err(|_| AuthError::Offline)?;
        let value: Refreshed = self.response(response).await?;
        if value.project_id != config.project_id
            && config.project_number.as_deref() != Some(value.project_id.as_str())
        {
            return Err(AuthError::InvalidResponse);
        }
        Ok(Tokens {
            local_id: value.user_id,
            id_token: value.id_token,
            refresh_token: value.refresh_token,
            expires_in: value.expires_in,
        })
    }
    pub(crate) async fn profile(
        &self,
        config: &FirebaseConfig,
        token: &str,
        expected_uid: &str,
    ) -> Result<Account, AuthError> {
        let mut users: Users = self
            .post(config, "lookup", serde_json::json!({"idToken":token}))
            .await?;
        if users.users.len() != 1 {
            return Err(AuthError::InvalidResponse);
        }
        let user = users.users.remove(0);
        if user.local_id != expected_uid || user.email.len() > 320 || !user.email.contains('@') {
            return Err(AuthError::InvalidResponse);
        }
        Ok(Account {
            user_id: user.local_id,
            email: user.email,
            email_verified: user.email_verified,
        })
    }
}
