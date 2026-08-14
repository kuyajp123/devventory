use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VaultStatus {
    pub(crate) is_configured: bool,
    pub(crate) is_unlocked: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CredentialSource {
    pub(crate) id: Uuid,
    pub(crate) definition_key: Option<String>,
    pub(crate) name: String,
    pub(crate) description: Option<String>,
    pub(crate) icon_path: Option<String>,
    pub(crate) project_ids: Vec<Uuid>,
    pub(crate) credential_count: u32,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone)]
pub(super) struct StoredCredentialSource {
    pub(super) id: Uuid,
    pub(super) definition_key: Option<String>,
    pub(super) name: String,
    pub(super) description: Option<String>,
    pub(super) icon_file_name: Option<String>,
    pub(super) project_ids: Vec<Uuid>,
    pub(super) credential_count: u32,
    pub(super) created_at: String,
    pub(super) updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CredentialEnvironmentLink {
    pub(crate) project_id: Uuid,
    pub(crate) environment_id: Uuid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Credential {
    pub(crate) id: Uuid,
    pub(crate) source_id: Uuid,
    pub(crate) key: String,
    pub(crate) normalized_key: String,
    pub(crate) notes: Option<String>,
    pub(crate) has_value: bool,
    pub(crate) project_ids: Vec<Uuid>,
    pub(crate) environment_links: Vec<CredentialEnvironmentLink>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone)]
pub(crate) struct NewCredentialSource {
    pub(crate) definition_key: Option<String>,
    pub(crate) name: String,
    pub(crate) description: Option<String>,
    pub(crate) project_ids: Vec<Uuid>,
    pub(crate) icon_source_path: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct UpdateCredentialSource {
    pub(crate) source_id: Uuid,
    pub(crate) name: String,
    pub(crate) description: Option<String>,
    pub(crate) project_ids: Vec<Uuid>,
    pub(crate) icon_source_path: Option<String>,
    pub(crate) remove_icon: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct NewCredential {
    pub(crate) key: String,
    pub(crate) notes: Option<String>,
    pub(crate) value: Option<String>,
    pub(crate) project_ids: Vec<Uuid>,
    pub(crate) environment_links: Vec<CredentialEnvironmentLink>,
}

#[derive(Debug, Clone)]
pub(crate) struct CreateCredentials {
    pub(crate) source_id: Uuid,
    pub(crate) credentials: Vec<NewCredential>,
}

#[derive(Debug, Clone)]
pub(crate) struct UpdateCredential {
    pub(crate) credential_id: Uuid,
    pub(crate) key: String,
    pub(crate) notes: Option<String>,
    pub(crate) project_ids: Vec<Uuid>,
    pub(crate) environment_links: Vec<CredentialEnvironmentLink>,
}

#[derive(Debug, Clone)]
pub(super) struct PreparedCredential {
    pub(super) id: Uuid,
    pub(super) secret_reference: Option<Uuid>,
    pub(super) credential: NewCredential,
}
