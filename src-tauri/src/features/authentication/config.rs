use serde::Deserialize;

// Firebase client configuration is public, not a service-account credential.
// https://firebase.google.com/docs/projects/api-keys
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FirebaseConfig {
    pub(crate) project_id: String,
    #[serde(default)]
    pub(crate) project_number: Option<String>,
    pub(crate) api_key: String,
    pub(crate) worker_url: String,
}
impl FirebaseConfig {
    pub(crate) fn bundled() -> Option<Self> {
        let config: Self =
            serde_json::from_str(include_str!("../../../firebase-public.json")).ok()?;
        if config.project_id.len() < 5
            || config.project_id.len() > 63
            || !config
                .project_id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
            || config.api_key.len() != 39
            || !config.api_key.starts_with("AIza")
            || !config
                .api_key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        {
            return None;
        }
        Some(config)
    }
}
