use std::collections::{BTreeMap, HashMap, HashSet};

use thiserror::Error;
use uuid::Uuid;

use crate::{
    features::validation_center::{ValidationError, ValidationRule, ValidationService},
    shared::errors::command::CommandError,
};

use super::{
    error::EnvironmentError,
    model::{EnvironmentMatrixPage, EnvironmentMatrixQuery, EnvironmentMatrixRuleKey},
    service::EnvironmentService,
};

#[derive(Debug, Clone)]
pub(crate) struct EnvironmentWorkspaceService {
    environment_service: EnvironmentService,
    validation_service: ValidationService,
}

impl EnvironmentWorkspaceService {
    pub(crate) fn new(
        environment_service: EnvironmentService,
        validation_service: ValidationService,
    ) -> Self {
        Self {
            environment_service,
            validation_service,
        }
    }

    pub(crate) async fn matrix(
        &self,
        query: EnvironmentMatrixQuery,
    ) -> Result<EnvironmentMatrixPage, EnvironmentWorkspaceError> {
        let rules = self
            .validation_service
            .list_rules(query.project_id)
            .await?
            .into_iter()
            .filter(|rule| {
                rule.enabled
                    && query
                        .environment_id
                        .is_none_or(|environment_id| rule.environment_ids.contains(&environment_id))
            })
            .collect::<Vec<_>>();
        let rule_keys = unique_rule_keys(&rules);
        let mut matrix = self
            .environment_service
            .matrix_with_rule_keys(query.clone(), &rule_keys)
            .await?;
        let normalized_keys = matrix
            .rows
            .iter()
            .map(|row| normalize_key(&row.key_name))
            .collect::<Vec<_>>();
        let environment_ids = query.environment_id.map_or_else(
            || {
                matrix
                    .environments
                    .iter()
                    .map(|environment| environment.id)
                    .collect::<Vec<_>>()
            },
            |environment_id| vec![environment_id],
        );
        let issues = self
            .validation_service
            .open_matrix_issues(query.project_id, &normalized_keys, &environment_ids)
            .await?;

        let mut rules_by_cell = HashMap::<(String, Uuid), Vec<ValidationRule>>::new();
        let mut applicable_rule_cells = HashSet::<(String, Uuid, Uuid)>::new();
        for rule in rules {
            let normalized_key = normalize_key(&rule.key_name);
            for environment_id in &rule.environment_ids {
                applicable_rule_cells.insert((normalized_key.clone(), *environment_id, rule.id));
                rules_by_cell
                    .entry((normalized_key.clone(), *environment_id))
                    .or_default()
                    .push(rule.clone());
            }
        }
        let mut issues_by_cell = HashMap::new();
        for issue in issues {
            let Some(environment_id) = issue.environment_id else {
                continue;
            };
            let normalized_key = normalize_key(&issue.key_name);
            if issue.rule_id.is_some_and(|rule_id| {
                !applicable_rule_cells.contains(&(normalized_key.clone(), environment_id, rule_id))
            }) {
                continue;
            }
            issues_by_cell
                .entry((normalized_key, environment_id))
                .or_insert_with(Vec::new)
                .push(issue);
        }

        for row in &mut matrix.rows {
            let normalized_key = normalize_key(&row.key_name);
            for (cell, environment) in row.cells.iter_mut().zip(&matrix.environments) {
                cell.validation.rules = rules_by_cell
                    .remove(&(normalized_key.clone(), environment.id))
                    .unwrap_or_default();
                cell.validation.open_issues = issues_by_cell
                    .remove(&(normalized_key.clone(), environment.id))
                    .unwrap_or_default();
            }
        }

        Ok(matrix)
    }
}

fn unique_rule_keys(rules: &[ValidationRule]) -> Vec<EnvironmentMatrixRuleKey> {
    rules
        .iter()
        .fold(BTreeMap::new(), |mut keys, rule| {
            keys.entry(normalize_key(&rule.key_name))
                .or_insert_with(|| rule.key_name.clone());
            keys
        })
        .into_iter()
        .map(|(normalized_name, name)| EnvironmentMatrixRuleKey {
            name,
            normalized_name,
        })
        .collect()
}

fn normalize_key(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}

#[derive(Debug, Error)]
pub(crate) enum EnvironmentWorkspaceError {
    #[error(transparent)]
    Environment(#[from] EnvironmentError),
    #[error(transparent)]
    Validation(#[from] ValidationError),
}

impl From<EnvironmentWorkspaceError> for CommandError {
    fn from(error: EnvironmentWorkspaceError) -> Self {
        match error {
            EnvironmentWorkspaceError::Environment(error) => error.into(),
            EnvironmentWorkspaceError::Validation(error) => error.into(),
        }
    }
}
