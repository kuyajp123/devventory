use std::collections::HashSet;

use serde::Deserialize;
use uuid::Uuid;

use super::error::CredentialVaultError;
use super::model::{
    CreateCredentials, CredentialEnvironmentLink, NewCredential, NewCredentialSource,
    UpdateCredential, UpdateCredentialSource,
};

const MAX_CREDENTIALS_PER_REQUEST: usize = 50;
const MAX_DESCRIPTION_LENGTH: usize = 2_000;
const MAX_KEY_LENGTH: usize = 255;
const MAX_NAME_LENGTH: usize = 120;
const MAX_NOTES_LENGTH: usize = 2_000;
const MAX_PASSWORD_LENGTH: usize = 1_024;
const MAX_SECRET_BYTES: usize = 1_048_576;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PasswordInput {
    password: String,
}

impl PasswordInput {
    pub(crate) fn password(self) -> Result<String, CredentialVaultError> {
        if self.password.is_empty() || self.password.chars().count() > MAX_PASSWORD_LENGTH {
            return Err(CredentialVaultError::InvalidInput);
        }
        Ok(self.password)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SourceIdInput {
    source_id: String,
}

impl SourceIdInput {
    pub(crate) fn source_id(&self) -> Result<Uuid, CredentialVaultError> {
        parse_uuid(&self.source_id)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CredentialIdInput {
    credential_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ListCredentialsInput {
    source_id: Option<String>,
}

impl ListCredentialsInput {
    pub(crate) fn source_id(&self) -> Result<Option<Uuid>, CredentialVaultError> {
        self.source_id.as_deref().map(parse_uuid).transpose()
    }
}

impl CredentialIdInput {
    pub(crate) fn credential_id(&self) -> Result<Uuid, CredentialVaultError> {
        parse_uuid(&self.credential_id)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SecretValueInput {
    credential_id: String,
    value: String,
}

impl SecretValueInput {
    pub(crate) fn parse(self) -> Result<(Uuid, String), CredentialVaultError> {
        validate_secret(&self.value)?;
        Ok((parse_uuid(&self.credential_id)?, self.value))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateCredentialSourceInput {
    definition_key: Option<String>,
    name: String,
    description: Option<String>,
    project_ids: Vec<String>,
    icon_source_path: Option<String>,
}

impl TryFrom<CreateCredentialSourceInput> for NewCredentialSource {
    type Error = CredentialVaultError;

    fn try_from(input: CreateCredentialSourceInput) -> Result<Self, Self::Error> {
        Ok(Self {
            definition_key: normalize_optional(input.definition_key, 64)?,
            name: normalize_required(input.name, MAX_NAME_LENGTH)?,
            description: normalize_optional(input.description, MAX_DESCRIPTION_LENGTH)?,
            project_ids: parse_unique_ids(input.project_ids)?,
            icon_source_path: normalize_optional(input.icon_source_path, 4_096)?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UpdateCredentialSourceInput {
    source_id: String,
    name: String,
    description: Option<String>,
    project_ids: Vec<String>,
    icon_source_path: Option<String>,
    remove_icon: bool,
}

impl TryFrom<UpdateCredentialSourceInput> for UpdateCredentialSource {
    type Error = CredentialVaultError;

    fn try_from(input: UpdateCredentialSourceInput) -> Result<Self, Self::Error> {
        Ok(Self {
            source_id: parse_uuid(&input.source_id)?,
            name: normalize_required(input.name, MAX_NAME_LENGTH)?,
            description: normalize_optional(input.description, MAX_DESCRIPTION_LENGTH)?,
            project_ids: parse_unique_ids(input.project_ids)?,
            icon_source_path: normalize_optional(input.icon_source_path, 4_096)?,
            remove_icon: input.remove_icon,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CredentialEnvironmentLinkInput {
    project_id: String,
    environment_id: String,
}

impl TryFrom<CredentialEnvironmentLinkInput> for CredentialEnvironmentLink {
    type Error = CredentialVaultError;

    fn try_from(input: CredentialEnvironmentLinkInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            environment_id: parse_uuid(&input.environment_id)?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NewCredentialInput {
    key: String,
    notes: Option<String>,
    value: Option<String>,
    project_ids: Vec<String>,
    environment_links: Vec<CredentialEnvironmentLinkInput>,
}

impl TryFrom<NewCredentialInput> for NewCredential {
    type Error = CredentialVaultError;

    fn try_from(input: NewCredentialInput) -> Result<Self, Self::Error> {
        if let Some(value) = input.value.as_deref() {
            validate_secret(value)?;
        }
        let project_ids = parse_unique_ids(input.project_ids)?;
        let environment_links = parse_environment_links(input.environment_links, &project_ids)?;
        Ok(Self {
            key: normalize_required(input.key, MAX_KEY_LENGTH)?,
            notes: normalize_optional(input.notes, MAX_NOTES_LENGTH)?,
            value: input.value,
            project_ids,
            environment_links,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateCredentialsInput {
    source_id: String,
    credentials: Vec<NewCredentialInput>,
}

impl TryFrom<CreateCredentialsInput> for CreateCredentials {
    type Error = CredentialVaultError;

    fn try_from(input: CreateCredentialsInput) -> Result<Self, Self::Error> {
        if input.credentials.is_empty() || input.credentials.len() > MAX_CREDENTIALS_PER_REQUEST {
            return Err(CredentialVaultError::InvalidInput);
        }
        let credentials = input
            .credentials
            .into_iter()
            .map(NewCredential::try_from)
            .collect::<Result<Vec<_>, _>>()?;
        let mut keys = HashSet::new();
        if credentials
            .iter()
            .any(|item| !keys.insert(item.key.trim().to_ascii_uppercase()))
        {
            return Err(CredentialVaultError::DuplicateCredential);
        }
        Ok(Self {
            source_id: parse_uuid(&input.source_id)?,
            credentials,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UpdateCredentialInput {
    credential_id: String,
    key: String,
    notes: Option<String>,
    project_ids: Vec<String>,
    environment_links: Vec<CredentialEnvironmentLinkInput>,
}

impl TryFrom<UpdateCredentialInput> for UpdateCredential {
    type Error = CredentialVaultError;

    fn try_from(input: UpdateCredentialInput) -> Result<Self, Self::Error> {
        let project_ids = parse_unique_ids(input.project_ids)?;
        let environment_links = parse_environment_links(input.environment_links, &project_ids)?;
        Ok(Self {
            credential_id: parse_uuid(&input.credential_id)?,
            key: normalize_required(input.key, MAX_KEY_LENGTH)?,
            notes: normalize_optional(input.notes, MAX_NOTES_LENGTH)?,
            project_ids,
            environment_links,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewEnvSecretsInput {
    project_id: String,
    relative_path: String,
}

impl PreviewEnvSecretsInput {
    pub(crate) fn parse(self) -> Result<(Uuid, String), CredentialVaultError> {
        let project_id = parse_uuid(&self.project_id)?;
        let relative_path = normalize_required(self.relative_path, 4_096)?;
        Ok((project_id, relative_path))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ImportEnvSecretsInput {
    project_id: String,
    relative_path: String,
    source_id: Option<String>,
    source_name: Option<String>,
    selected_keys: Vec<String>,
    environment_id: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct ValidatedImportEnvSecrets {
    pub(crate) project_id: Uuid,
    pub(crate) relative_path: String,
    pub(crate) source_id: Option<Uuid>,
    pub(crate) source_name: Option<String>,
    pub(crate) selected_keys: Vec<String>,
    pub(crate) environment_id: Option<Uuid>,
}

impl TryFrom<ImportEnvSecretsInput> for ValidatedImportEnvSecrets {
    type Error = CredentialVaultError;

    fn try_from(input: ImportEnvSecretsInput) -> Result<Self, Self::Error> {
        let project_id = parse_uuid(&input.project_id)?;
        let relative_path = normalize_required(input.relative_path, 4_096)?;
        let source_id = input.source_id.as_deref().map(parse_uuid).transpose()?;
        let source_name = normalize_optional(input.source_name, MAX_NAME_LENGTH)?;
        let environment_id = input
            .environment_id
            .as_deref()
            .map(parse_uuid)
            .transpose()?;

        if source_id.is_none() && source_name.is_none() {
            return Err(CredentialVaultError::InvalidInput);
        }

        if input.selected_keys.is_empty() {
            return Err(CredentialVaultError::InvalidInput);
        }

        let mut seen = HashSet::new();
        let selected_keys = input
            .selected_keys
            .into_iter()
            .map(|k| normalize_required(k, MAX_KEY_LENGTH))
            .filter(|res| match res {
                Ok(k) => seen.insert(k.to_ascii_uppercase()),
                Err(_) => true,
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Self {
            project_id,
            relative_path,
            source_id,
            source_name,
            selected_keys,
            environment_id,
        })
    }
}

fn parse_environment_links(
    inputs: Vec<CredentialEnvironmentLinkInput>,
    project_ids: &[Uuid],
) -> Result<Vec<CredentialEnvironmentLink>, CredentialVaultError> {
    let projects = project_ids.iter().copied().collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    inputs
        .into_iter()
        .map(CredentialEnvironmentLink::try_from)
        .map(|result| {
            let link = result?;
            if !projects.contains(&link.project_id)
                || !seen.insert((link.project_id, link.environment_id))
            {
                return Err(CredentialVaultError::InvalidInput);
            }
            Ok(link)
        })
        .collect()
}

fn parse_unique_ids(values: Vec<String>) -> Result<Vec<Uuid>, CredentialVaultError> {
    let mut seen = HashSet::new();
    values
        .iter()
        .map(|value| parse_uuid(value))
        .map(|result| {
            let id = result?;
            if !seen.insert(id) {
                return Err(CredentialVaultError::InvalidInput);
            }
            Ok(id)
        })
        .collect()
}

fn parse_uuid(value: &str) -> Result<Uuid, CredentialVaultError> {
    Uuid::parse_str(value).map_err(|_| CredentialVaultError::InvalidInput)
}

fn normalize_required(
    value: String,
    maximum_length: usize,
) -> Result<String, CredentialVaultError> {
    let value = value.trim().to_owned();
    if value.is_empty()
        || value.chars().count() > maximum_length
        || value.chars().any(char::is_control)
    {
        return Err(CredentialVaultError::InvalidInput);
    }
    Ok(value)
}

fn normalize_optional(
    value: Option<String>,
    maximum_length: usize,
) -> Result<Option<String>, CredentialVaultError> {
    match value {
        None => Ok(None),
        Some(value) => {
            let value = value.trim().to_owned();
            if value.is_empty() {
                Ok(None)
            } else if value.chars().count() > maximum_length {
                Err(CredentialVaultError::InvalidInput)
            } else {
                Ok(Some(value))
            }
        }
    }
}

fn validate_secret(value: &str) -> Result<(), CredentialVaultError> {
    if value.len() > MAX_SECRET_BYTES {
        return Err(CredentialVaultError::InvalidInput);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_value_preserves_whitespace_and_newlines_exactly() {
        let credential_id = Uuid::new_v4();
        let input: SecretValueInput = serde_json::from_value(serde_json::json!({
            "credentialId": credential_id,
            "value": "  -----BEGIN KEY-----\r\nabc  \r\n-----END KEY-----\n"
        }))
        .expect("input should deserialize");

        let (_, value) = input.parse().expect("input should validate");

        assert_eq!(
            value,
            "  -----BEGIN KEY-----\r\nabc  \r\n-----END KEY-----\n"
        );
    }

    #[test]
    fn credential_key_retains_metadata_validation() {
        let source_id = Uuid::new_v4();
        let input: CreateCredentialsInput = serde_json::from_value(serde_json::json!({
            "sourceId": source_id,
            "credentials": [{
                "key": "line\nbreak",
                "notes": null,
                "value": null,
                "projectIds": [],
                "environmentLinks": []
            }]
        }))
        .expect("input should deserialize");

        assert!(matches!(
            CreateCredentials::try_from(input),
            Err(CredentialVaultError::InvalidInput)
        ));
    }
}
