use std::collections::HashSet;

use serde::Deserialize;
use uuid::Uuid;

use super::{
    error::ValidationError,
    model::{
        ManifestCollisionChoice, SaveValidationRule, ValidationIssueQuery, ValidationIssueSort,
        ValidationIssueStatus, ValidationIssueType, ValidationRuleType, ValidationSeverity,
    },
};

const MAX_DESCRIPTION_LENGTH: usize = 2_000;
const MAX_ENVIRONMENTS: usize = 100;
const MAX_KEY_LENGTH: usize = 255;
const MAX_PAGE_SIZE: u32 = 100;
const MAX_PATH_LENGTH: usize = 1_024;
const MAX_RULES: usize = 500;
const MAX_SEARCH_LENGTH: usize = 128;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProjectInput {
    project_id: String,
}

impl ProjectInput {
    pub(crate) fn project_id(&self) -> Result<Uuid, ValidationError> {
        parse_uuid(&self.project_id)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SaveValidationRuleInput {
    project_id: String,
    rule_id: Option<String>,
    key_name: String,
    rule_type: String,
    severity: String,
    description: Option<String>,
    enabled: bool,
    environment_ids: Vec<String>,
}

impl TryFrom<SaveValidationRuleInput> for SaveValidationRule {
    type Error = ValidationError;

    fn try_from(input: SaveValidationRuleInput) -> Result<Self, Self::Error> {
        let key_name = input.key_name.trim().to_owned();
        if key_name.is_empty()
            || key_name.chars().count() > MAX_KEY_LENGTH
            || !valid_key_name(&key_name)
        {
            return Err(ValidationError::InvalidInput);
        }
        if input.environment_ids.is_empty() || input.environment_ids.len() > MAX_ENVIRONMENTS {
            return Err(ValidationError::InvalidInput);
        }
        let environment_ids = input
            .environment_ids
            .iter()
            .map(|value| parse_uuid(value))
            .collect::<Result<Vec<_>, _>>()?;
        if environment_ids
            .iter()
            .copied()
            .collect::<HashSet<_>>()
            .len()
            != environment_ids.len()
        {
            return Err(ValidationError::InvalidInput);
        }

        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            rule_id: input.rule_id.as_deref().map(parse_uuid).transpose()?,
            key_name,
            rule_type: ValidationRuleType::try_from(input.rule_type.as_str())
                .map_err(|_| ValidationError::InvalidInput)?,
            severity: ValidationSeverity::try_from(input.severity.as_str())
                .map_err(|_| ValidationError::InvalidInput)?,
            description: normalize_optional(input.description, MAX_DESCRIPTION_LENGTH)?,
            enabled: input.enabled,
            environment_ids,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ValidationRuleIdInput {
    project_id: String,
    rule_id: String,
}

impl ValidationRuleIdInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid), ValidationError> {
        Ok((parse_uuid(&self.project_id)?, parse_uuid(&self.rule_id)?))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ValidationRuleOrderInput {
    project_id: String,
    rule_ids: Vec<String>,
}

impl ValidationRuleOrderInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Vec<Uuid>), ValidationError> {
        if self.rule_ids.len() > MAX_RULES {
            return Err(ValidationError::InvalidInput);
        }
        let ids = self
            .rule_ids
            .iter()
            .map(|value| parse_uuid(value))
            .collect::<Result<Vec<_>, _>>()?;
        if ids.iter().copied().collect::<HashSet<_>>().len() != ids.len() {
            return Err(ValidationError::InvalidInput);
        }
        Ok((parse_uuid(&self.project_id)?, ids))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ValidationIssueQueryInput {
    project_id: String,
    search: Option<String>,
    environment_id: Option<String>,
    issue_type: Option<String>,
    rule_type: Option<String>,
    severity: Option<String>,
    status: Option<String>,
    sort: Option<String>,
    descending: Option<bool>,
    page: u32,
    page_size: u32,
}

impl TryFrom<ValidationIssueQueryInput> for ValidationIssueQuery {
    type Error = ValidationError;

    fn try_from(input: ValidationIssueQueryInput) -> Result<Self, Self::Error> {
        if input.page == 0 || input.page_size == 0 || input.page_size > MAX_PAGE_SIZE {
            return Err(ValidationError::InvalidInput);
        }
        let sort = match input.sort.as_deref().unwrap_or("updated_at") {
            "updated_at" => ValidationIssueSort::UpdatedAt,
            "severity" => ValidationIssueSort::Severity,
            "key" => ValidationIssueSort::Key,
            "environment" => ValidationIssueSort::Environment,
            "status" => ValidationIssueSort::Status,
            _ => return Err(ValidationError::InvalidInput),
        };
        Ok(Self {
            project_id: parse_uuid(&input.project_id)?,
            search: normalize_optional(input.search, MAX_SEARCH_LENGTH)?,
            environment_id: input
                .environment_id
                .as_deref()
                .map(parse_uuid)
                .transpose()?,
            issue_type: input
                .issue_type
                .as_deref()
                .map(ValidationIssueType::try_from)
                .transpose()
                .map_err(|_| ValidationError::InvalidInput)?,
            rule_type: input
                .rule_type
                .as_deref()
                .map(ValidationRuleType::try_from)
                .transpose()
                .map_err(|_| ValidationError::InvalidInput)?,
            severity: input
                .severity
                .as_deref()
                .map(ValidationSeverity::try_from)
                .transpose()
                .map_err(|_| ValidationError::InvalidInput)?,
            status: input
                .status
                .as_deref()
                .map(ValidationIssueStatus::try_from)
                .transpose()
                .map_err(|_| ValidationError::InvalidInput)?,
            sort,
            descending: input.descending.unwrap_or(true),
            page: input.page,
            page_size: input.page_size,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ValidationIssueStatusInput {
    project_id: String,
    issue_id: String,
    status: String,
}

impl ValidationIssueStatusInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, Uuid, ValidationIssueStatus), ValidationError> {
        let status = ValidationIssueStatus::try_from(self.status.as_str())
            .map_err(|_| ValidationError::InvalidInput)?;
        if status == ValidationIssueStatus::Resolved {
            return Err(ValidationError::InvalidInput);
        }
        Ok((
            parse_uuid(&self.project_id)?,
            parse_uuid(&self.issue_id)?,
            status,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ManifestInput {
    project_id: String,
    relative_path: String,
}

impl ManifestInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, String), ValidationError> {
        let relative_path = self.relative_path.trim().replace('\\', "/");
        if relative_path.is_empty() || relative_path.chars().count() > MAX_PATH_LENGTH {
            return Err(ValidationError::InvalidInput);
        }
        Ok((parse_uuid(&self.project_id)?, relative_path))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ExportManifestInput {
    project_id: String,
    relative_path: String,
    collision_choice: String,
}

impl ExportManifestInput {
    pub(crate) fn parse(&self) -> Result<(Uuid, String, ManifestCollisionChoice), ValidationError> {
        let (project_id, relative_path) = ManifestInput {
            project_id: self.project_id.clone(),
            relative_path: self.relative_path.clone(),
        }
        .parse()?;
        let collision_choice = match self.collision_choice.as_str() {
            "cancel" => ManifestCollisionChoice::Cancel,
            "replace" => ManifestCollisionChoice::Replace,
            _ => return Err(ValidationError::InvalidInput),
        };
        Ok((project_id, relative_path, collision_choice))
    }
}

fn parse_uuid(value: &str) -> Result<Uuid, ValidationError> {
    Uuid::parse_str(value).map_err(|_| ValidationError::InvalidInput)
}

fn normalize_optional(
    value: Option<String>,
    maximum_length: usize,
) -> Result<Option<String>, ValidationError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = value.trim().to_owned();
    if value.is_empty() {
        Ok(None)
    } else if value.chars().count() > maximum_length {
        Err(ValidationError::InvalidInput)
    } else {
        Ok(Some(value))
    }
}

fn valid_key_name(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_KEY_LENGTH {
        return false;
    }
    if trimmed.contains("..") || trimmed.starts_with('/') || trimmed.ends_with('/') {
        return false;
    }
    trimmed.chars().all(|character| {
        let code_point = character as u32;
        code_point > 31 && code_point != 127
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rule_input_rejects_duplicate_targets_and_invalid_names() {
        let project_id = Uuid::new_v4();
        let environment_id = Uuid::new_v4();
        for value in [
            serde_json::json!({
                "projectId": project_id,
                "keyName": "",
                "ruleType": "required",
                "severity": "error",
                "enabled": true,
                "environmentIds": [environment_id]
            }),
            serde_json::json!({
                "projectId": project_id,
                "keyName": "   ",
                "ruleType": "required",
                "severity": "error",
                "enabled": true,
                "environmentIds": [environment_id]
            }),
            serde_json::json!({
                "projectId": project_id,
                "keyName": "../etc/passwd",
                "ruleType": "required",
                "severity": "error",
                "enabled": true,
                "environmentIds": [environment_id]
            }),
            serde_json::json!({
                "projectId": project_id,
                "keyName": "VALID_NAME",
                "ruleType": "required",
                "severity": "error",
                "enabled": true,
                "environmentIds": [environment_id, environment_id]
            }),
        ] {
            let input: SaveValidationRuleInput =
                serde_json::from_value(value).expect("input shape");
            assert!(matches!(
                SaveValidationRule::try_from(input),
                Err(ValidationError::InvalidInput)
            ));
        }
    }

    #[test]
    fn rule_input_accepts_custom_key_names() {
        let project_id = Uuid::new_v4();
        let environment_id = Uuid::new_v4();
        for value in [
            "DATABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "NEXT_PUBLIC_API_URL",
            "SERVICE-ACCOUNT.json",
            "service-account.json",
            "service-account.prod.json",
            "devventory-firebase-adminsdk.json",
            "google-services.json",
            "signing-key.p12",
        ] {
            let input: SaveValidationRuleInput = serde_json::from_value(serde_json::json!({
                "projectId": project_id,
                "keyName": value,
                "ruleType": "required",
                "severity": "error",
                "enabled": true,
                "environmentIds": [environment_id]
            }))
            .expect("input shape");
            assert!(
                SaveValidationRule::try_from(input).is_ok(),
                "expected {value} to be accepted"
            );
        }
    }
}
