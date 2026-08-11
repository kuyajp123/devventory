use serde::Deserialize;
use uuid::Uuid;

use super::error::EnvironmentError;
use super::model::{
    CopyCustomEnvironmentKey, CopyCustomEnvironmentSource, CreateCustomEnvironmentSource,
    CreateEnvironment, EnvironmentMatrixQuery, EnvironmentSourceCandidateQuery, UpdateEnvironment,
};

const MAX_DESCRIPTION_LENGTH: usize = 2_000;
const MAX_ENVIRONMENT_NAME_LENGTH: usize = 120;
const MAX_PAGE_SIZE: u32 = 100;
const MAX_PATH_LENGTH: usize = 1_024;
const MAX_SEARCH_LENGTH: usize = 128;
const MAX_SOURCES: usize = 64;
const MAX_CUSTOM_KEYS: usize = 200;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProjectInput {
    project_id: String,
}

impl ProjectInput {
    pub(crate) fn project_id(&self) -> Result<Uuid, EnvironmentError> {
        parse_uuid(&self.project_id)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateEnvironmentInput {
    project_id: String,
    name: String,
    description: Option<String>,
}

impl TryFrom<CreateEnvironmentInput> for CreateEnvironment {
    type Error = EnvironmentError;

    fn try_from(input: CreateEnvironmentInput) -> Result<Self, Self::Error> {
        let name = normalize_required(input.name, MAX_ENVIRONMENT_NAME_LENGTH)?;
        let description = normalize_optional(input.description, MAX_DESCRIPTION_LENGTH)?;
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            name,
            description,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UpdateEnvironmentInput {
    project_id: String,
    environment_id: String,
    name: String,
    description: Option<String>,
}

impl TryFrom<UpdateEnvironmentInput> for UpdateEnvironment {
    type Error = EnvironmentError;

    fn try_from(input: UpdateEnvironmentInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            environment_id: parse_uuid(&input.environment_id)?,
            name: normalize_required(input.name, MAX_ENVIRONMENT_NAME_LENGTH)?,
            description: normalize_optional(input.description, MAX_DESCRIPTION_LENGTH)?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EnvironmentIdInput {
    project_id: String,
    environment_id: String,
}

impl EnvironmentIdInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid), EnvironmentError> {
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.environment_id)?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EnvironmentOrderInput {
    project_id: String,
    environment_ids: Vec<String>,
}

impl EnvironmentOrderInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Vec<Uuid>), EnvironmentError> {
        if self.environment_ids.is_empty() || self.environment_ids.len() > 100 {
            return Err(EnvironmentError::InvalidInput);
        }
        Ok((
            parse_uuid(&self.project_id)?,
            self.environment_ids
                .iter()
                .map(|value| parse_uuid(value))
                .collect::<Result<_, _>>()?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AddEnvironmentSourceInput {
    project_id: String,
    environment_id: String,
    relative_path: String,
}

impl AddEnvironmentSourceInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid, String), EnvironmentError> {
        let relative_path = normalize_required(self.relative_path.clone(), MAX_PATH_LENGTH)?;
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.environment_id)?,
            relative_path,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EnvironmentSourceIdInput {
    project_id: String,
    environment_id: String,
    source_id: String,
}

impl EnvironmentSourceIdInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid, Uuid), EnvironmentError> {
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.environment_id)?,
            parse_uuid(&self.source_id)?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EnvironmentSourceOrderInput {
    project_id: String,
    environment_id: String,
    source_ids: Vec<String>,
}

impl EnvironmentSourceOrderInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid, Vec<Uuid>), EnvironmentError> {
        if self.source_ids.len() > MAX_SOURCES {
            return Err(EnvironmentError::InvalidInput);
        }
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.environment_id)?,
            self.source_ids
                .iter()
                .map(|value| parse_uuid(value))
                .collect::<Result<_, _>>()?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateCustomEnvironmentSourceInput {
    project_id: String,
    environment_id: String,
    name: String,
    key_names: Vec<String>,
}

impl TryFrom<CreateCustomEnvironmentSourceInput> for CreateCustomEnvironmentSource {
    type Error = EnvironmentError;

    fn try_from(input: CreateCustomEnvironmentSourceInput) -> Result<Self, Self::Error> {
        if input.key_names.len() > MAX_CUSTOM_KEYS {
            return Err(EnvironmentError::InvalidInput);
        }
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            environment_id: parse_uuid(&input.environment_id)?,
            name: normalize_required(input.name, MAX_ENVIRONMENT_NAME_LENGTH)?,
            key_names: input
                .key_names
                .into_iter()
                .map(|name| normalize_required(name, 255))
                .collect::<Result<_, _>>()?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RenameCustomEnvironmentSourceInput {
    project_id: String,
    environment_id: String,
    source_id: String,
    name: String,
}

impl RenameCustomEnvironmentSourceInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid, Uuid, String), EnvironmentError> {
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.environment_id)?,
            parse_uuid(&self.source_id)?,
            normalize_required(self.name.clone(), MAX_ENVIRONMENT_NAME_LENGTH)?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomEnvironmentKeyInput {
    project_id: String,
    environment_id: String,
    source_id: String,
    name: String,
}

impl CustomEnvironmentKeyInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid, Uuid, String), EnvironmentError> {
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.environment_id)?,
            parse_uuid(&self.source_id)?,
            normalize_required(self.name.clone(), 255)?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomEnvironmentKeyIdInput {
    project_id: String,
    environment_id: String,
    source_id: String,
    key_id: String,
}

impl CustomEnvironmentKeyIdInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid, Uuid, Uuid), EnvironmentError> {
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.environment_id)?,
            parse_uuid(&self.source_id)?,
            parse_uuid(&self.key_id)?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CopyCustomEnvironmentKeyInput {
    project_id: String,
    key_id: String,
    target_environment_id: String,
    target_source_id: String,
}

impl TryFrom<CopyCustomEnvironmentKeyInput> for CopyCustomEnvironmentKey {
    type Error = EnvironmentError;

    fn try_from(input: CopyCustomEnvironmentKeyInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            key_id: parse_uuid(&input.key_id)?,
            target_environment_id: parse_uuid(&input.target_environment_id)?,
            target_source_id: parse_uuid(&input.target_source_id)?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CopyCustomEnvironmentSourceInput {
    project_id: String,
    source_id: String,
    target_environment_id: String,
    target_name: Option<String>,
}

impl TryFrom<CopyCustomEnvironmentSourceInput> for CopyCustomEnvironmentSource {
    type Error = EnvironmentError;

    fn try_from(input: CopyCustomEnvironmentSourceInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            source_id: parse_uuid(&input.source_id)?,
            target_environment_id: parse_uuid(&input.target_environment_id)?,
            target_name: normalize_optional(input.target_name, MAX_ENVIRONMENT_NAME_LENGTH)?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EnvironmentSourceCandidateQueryInput {
    project_id: String,
    search: Option<String>,
    page: u32,
    page_size: u32,
}

impl TryFrom<EnvironmentSourceCandidateQueryInput> for EnvironmentSourceCandidateQuery {
    type Error = EnvironmentError;

    fn try_from(input: EnvironmentSourceCandidateQueryInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            search: normalize_optional(input.search, MAX_SEARCH_LENGTH)?,
            page: valid_page(input.page, input.page_size)?,
            page_size: input.page_size,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EnvironmentMatrixQueryInput {
    project_id: String,
    environment_id: Option<String>,
    search: Option<String>,
    page: u32,
    page_size: u32,
}

impl TryFrom<EnvironmentMatrixQueryInput> for EnvironmentMatrixQuery {
    type Error = EnvironmentError;

    fn try_from(input: EnvironmentMatrixQueryInput) -> Result<Self, Self::Error> {
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            environment_id: input
                .environment_id
                .as_deref()
                .map(parse_uuid)
                .transpose()?,
            search: normalize_optional(input.search, MAX_SEARCH_LENGTH)?,
            page: valid_page(input.page, input.page_size)?,
            page_size: input.page_size,
        })
    }
}

fn parse_uuid(value: &str) -> Result<Uuid, EnvironmentError> {
    Uuid::parse_str(value).map_err(|_| EnvironmentError::InvalidInput)
}

fn normalize_required(value: String, maximum_length: usize) -> Result<String, EnvironmentError> {
    let value = value.trim().to_owned();
    if value.is_empty()
        || value.chars().count() > maximum_length
        || value.chars().any(char::is_control)
    {
        return Err(EnvironmentError::InvalidInput);
    }
    Ok(value)
}

fn normalize_optional(
    value: Option<String>,
    maximum_length: usize,
) -> Result<Option<String>, EnvironmentError> {
    match value {
        None => Ok(None),
        Some(value) => {
            let value = value.trim().to_owned();
            if value.is_empty() {
                Ok(None)
            } else if value.chars().count() > maximum_length {
                Err(EnvironmentError::InvalidInput)
            } else {
                Ok(Some(value))
            }
        }
    }
}

fn valid_page(page: u32, page_size: u32) -> Result<u32, EnvironmentError> {
    if page == 0 || page_size == 0 || page_size > MAX_PAGE_SIZE {
        return Err(EnvironmentError::InvalidInput);
    }
    Ok(page)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_environment_input_treats_blank_description_as_none() {
        let project_id = Uuid::new_v4();
        let input: CreateEnvironmentInput = serde_json::from_value(serde_json::json!({
            "projectId": project_id,
            "name": "Development",
            "description": ""
        }))
        .expect("input should deserialize");

        let parsed = CreateEnvironment::try_from(input).expect("input should validate");

        assert_eq!(parsed.project_id, project_id);
        assert_eq!(parsed.name, "Development");
        assert_eq!(parsed.description, None);
    }
}
