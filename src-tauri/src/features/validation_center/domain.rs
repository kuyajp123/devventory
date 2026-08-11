use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fmt::Write,
};

use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::model::{
    DetectedIssue, EnvironmentHealth, ValidationEvaluation, ValidationIssueStatus,
    ValidationIssueType, ValidationOccurrence, ValidationRule, ValidationRuleType,
    ValidationSeverity, ValidationSnapshot, ValidationSource, ValidationSourceStatus,
};

pub(super) fn evaluate(snapshot: &ValidationSnapshot) -> ValidationEvaluation {
    let sources = snapshot
        .sources
        .iter()
        .map(|source| (source.id, source))
        .collect::<HashMap<_, _>>();
    let environments = snapshot
        .environments
        .iter()
        .map(|environment| (environment.id, environment))
        .collect::<HashMap<_, _>>();
    let active_rules = snapshot
        .rules
        .iter()
        .filter(|rule| rule.enabled)
        .collect::<Vec<_>>();
    let canonical_names = canonical_names(&snapshot.occurrences, &active_rules);
    let occurrences = group_occurrences(&snapshot.occurrences);
    let mut issues = Vec::new();

    detect_source_issues(snapshot, &mut issues);
    detect_rule_issues(
        snapshot.project_id,
        &active_rules,
        &occurrences,
        &sources,
        &mut issues,
    );
    detect_occurrence_issues(
        snapshot.project_id,
        &occurrences,
        &canonical_names,
        &sources,
        &mut issues,
    );

    issues.sort_by(|left, right| {
        severity_rank(right.severity)
            .cmp(&severity_rank(left.severity))
            .then_with(|| left.issue_type.as_str().cmp(right.issue_type.as_str()))
            .then_with(|| {
                environment_sort_key(left.environment_id, &environments)
                    .cmp(&environment_sort_key(right.environment_id, &environments))
            })
            .then_with(|| left.normalized_key.cmp(&right.normalized_key))
            .then_with(|| left.source_path.cmp(&right.source_path))
            .then_with(|| left.fingerprint.cmp(&right.fingerprint))
    });

    ValidationEvaluation { issues }
}

pub(super) fn calculate_health<'a>(
    issues: impl IntoIterator<
        Item = (
            &'a ValidationIssueType,
            ValidationIssueStatus,
            ValidationSeverity,
        ),
    >,
) -> EnvironmentHealth {
    let mut health = EnvironmentHealth::Healthy;

    for (issue_type, status, severity) in issues {
        if status != ValidationIssueStatus::Open {
            continue;
        }
        if matches!(
            issue_type,
            ValidationIssueType::SourceUnreadable | ValidationIssueType::ParseIssue
        ) {
            return EnvironmentHealth::Unknown;
        }
        health = match (health, severity) {
            (_, ValidationSeverity::Error) => EnvironmentHealth::Error,
            (EnvironmentHealth::Healthy, _) => EnvironmentHealth::Warning,
            (current, _) => current,
        };
    }

    health
}

pub(super) fn generate_manifest(
    definitions: impl IntoIterator<Item = (String, String)>,
    rules: &[ValidationRule],
) -> String {
    let mut names = definitions
        .into_iter()
        .filter_map(|(name, normalized)| {
            let normalized = normalize_key(&normalized);
            (!normalized.is_empty()).then_some((normalized, name.trim().to_owned()))
        })
        .collect::<BTreeMap<_, _>>();

    let mut ordered_rules = rules.iter().filter(|rule| rule.enabled).collect::<Vec<_>>();
    ordered_rules.sort_by_key(|rule| (rule.sort_order, rule.id));
    for rule in ordered_rules.into_iter().rev() {
        let normalized = normalize_key(&rule.key_name);
        if !normalized.is_empty() {
            names.insert(normalized, rule.key_name.trim().to_owned());
        }
    }

    names
        .into_values()
        .map(|name| format!("{name}=\n"))
        .collect()
}

type OccurrenceGroup<'a> = HashMap<(String, Uuid), Vec<&'a ValidationOccurrence>>;

fn group_occurrences(occurrences: &[ValidationOccurrence]) -> OccurrenceGroup<'_> {
    let mut groups = HashMap::new();
    for occurrence in occurrences {
        groups
            .entry((
                normalize_key(&occurrence.normalized_key),
                occurrence.environment_id,
            ))
            .or_insert_with(Vec::new)
            .push(occurrence);
    }
    groups
}

fn canonical_names(
    occurrences: &[ValidationOccurrence],
    rules: &[&ValidationRule],
) -> HashMap<String, String> {
    let mut names = HashMap::new();
    let mut ordered_rules = rules.to_vec();
    ordered_rules.sort_by_key(|rule| (rule.sort_order, rule.id));
    for rule in ordered_rules.into_iter().rev() {
        names.insert(
            normalize_key(&rule.key_name),
            rule.key_name.trim().to_owned(),
        );
    }

    let mut observed = occurrences.iter().collect::<Vec<_>>();
    observed.sort_by(|left, right| left.observed_name.cmp(&right.observed_name));
    for occurrence in observed.into_iter().rev() {
        names
            .entry(normalize_key(&occurrence.normalized_key))
            .or_insert_with(|| occurrence.key_name.clone());
    }
    names
}

fn detect_source_issues(snapshot: &ValidationSnapshot, issues: &mut Vec<DetectedIssue>) {
    for source in &snapshot.sources {
        let (issue_type, message) = match source.status {
            ValidationSourceStatus::Parsed => continue,
            ValidationSourceStatus::Missing | ValidationSourceStatus::Unreadable => (
                ValidationIssueType::SourceUnreadable,
                format!(
                    "Environment source '{}' could not be read.",
                    source.relative_path
                ),
            ),
            ValidationSourceStatus::ParseIssue
                if source.issue_code.as_deref() == Some("invalid_key") =>
            {
                (
                    ValidationIssueType::InvalidName,
                    format!(
                        "Environment source '{}' contains an invalid key name.",
                        source.relative_path
                    ),
                )
            }
            ValidationSourceStatus::ParseIssue
            | ValidationSourceStatus::UnsupportedEncoding
            | ValidationSourceStatus::NotParsed => (
                ValidationIssueType::ParseIssue,
                format!(
                    "Environment source '{}' could not be parsed safely.",
                    source.relative_path
                ),
            ),
        };
        issues.push(detected_issue(
            snapshot.project_id,
            issue_type,
            ValidationSeverity::Error,
            Some(source.environment_id),
            None,
            None,
            Some(source),
            "Environment source".to_owned(),
            String::new(),
            message,
            source.issue_line,
            None,
        ));
    }
}

fn detect_rule_issues(
    project_id: Uuid,
    rules: &[&ValidationRule],
    groups: &OccurrenceGroup<'_>,
    sources: &HashMap<Uuid, &ValidationSource>,
    issues: &mut Vec<DetectedIssue>,
) {
    for rule in rules {
        let normalized = normalize_key(&rule.key_name);
        for environment_id in &rule.environment_ids {
            let occurrences = groups
                .get(&(normalized.clone(), *environment_id))
                .map(Vec::as_slice)
                .unwrap_or_default();
            let active = occurrences
                .iter()
                .copied()
                .find(|occurrence| !occurrence.is_commented);
            let commented = occurrences.first().copied();
            let issue_type = match rule.rule_type {
                ValidationRuleType::Required if active.is_none() && commented.is_some() => {
                    Some(ValidationIssueType::RequiredCommented)
                }
                ValidationRuleType::Required if active.is_none() => {
                    Some(ValidationIssueType::RequiredMissing)
                }
                ValidationRuleType::Forbidden if active.is_some() => {
                    Some(ValidationIssueType::ForbiddenPresent)
                }
                _ => None,
            };
            let Some(issue_type) = issue_type else {
                continue;
            };
            let occurrence = active.or(commented);
            let source = occurrence.and_then(|item| sources.get(&item.source_id).copied());
            let message = match issue_type {
                ValidationIssueType::RequiredMissing => {
                    format!("Required key '{}' is missing.", rule.key_name)
                }
                ValidationIssueType::RequiredCommented => {
                    format!("Required key '{}' is commented out.", rule.key_name)
                }
                ValidationIssueType::ForbiddenPresent => {
                    format!("Forbidden key '{}' is present.", rule.key_name)
                }
                _ => unreachable!("rule issues are limited to required and forbidden rules"),
            };
            issues.push(detected_issue(
                project_id,
                issue_type,
                rule.severity,
                Some(*environment_id),
                occurrence.map(|item| item.key_definition_id),
                Some(rule.id),
                source,
                rule.key_name.clone(),
                normalized.clone(),
                message,
                occurrence.map(|item| item.line_number),
                occurrence.map(|item| item.observed_name.clone()),
            ));
        }
    }
}

fn detect_occurrence_issues(
    project_id: Uuid,
    groups: &OccurrenceGroup<'_>,
    canonical_names: &HashMap<String, String>,
    sources: &HashMap<Uuid, &ValidationSource>,
    issues: &mut Vec<DetectedIssue>,
) {
    for ((normalized, environment_id), occurrences) in groups {
        let active = occurrences
            .iter()
            .copied()
            .filter(|occurrence| !occurrence.is_commented)
            .collect::<Vec<_>>();
        if active.len() > 1 || active.iter().any(|occurrence| occurrence.is_duplicate) {
            let occurrence = active
                .first()
                .copied()
                .or_else(|| occurrences.first().copied());
            if let Some(occurrence) = occurrence {
                let source = sources.get(&occurrence.source_id).copied();
                issues.push(detected_issue(
                    project_id,
                    ValidationIssueType::Duplicate,
                    ValidationSeverity::Warning,
                    Some(*environment_id),
                    Some(occurrence.key_definition_id),
                    None,
                    source,
                    occurrence.key_name.clone(),
                    normalized.clone(),
                    format!("Key '{}' is declared more than once.", occurrence.key_name),
                    Some(occurrence.line_number),
                    Some(occurrence.observed_name.clone()),
                ));
            }
        }

        let Some(canonical_name) = canonical_names.get(normalized) else {
            continue;
        };
        let mut seen_sources = HashSet::new();
        for occurrence in occurrences {
            if occurrence.observed_name == *canonical_name
                || !seen_sources.insert(occurrence.source_id)
            {
                continue;
            }
            let source = sources.get(&occurrence.source_id).copied();
            issues.push(detected_issue(
                project_id,
                ValidationIssueType::CaseMismatch,
                ValidationSeverity::Warning,
                Some(*environment_id),
                Some(occurrence.key_definition_id),
                None,
                source,
                canonical_name.clone(),
                normalized.clone(),
                format!(
                    "Key '{}' should use the canonical spelling '{}'.",
                    occurrence.observed_name, canonical_name
                ),
                Some(occurrence.line_number),
                Some(occurrence.observed_name.clone()),
            ));
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn detected_issue(
    project_id: Uuid,
    issue_type: ValidationIssueType,
    severity: ValidationSeverity,
    environment_id: Option<Uuid>,
    key_definition_id: Option<Uuid>,
    rule_id: Option<Uuid>,
    source: Option<&ValidationSource>,
    key_name: String,
    normalized_key: String,
    message: String,
    line_number: Option<u32>,
    observed_name: Option<String>,
) -> DetectedIssue {
    let source_id = source.map(|item| item.id);
    let source_path = source.map(|item| item.relative_path.clone());
    let fingerprint_input = format!(
        "{}|{}|{}|{}|{}|{}",
        project_id,
        issue_type.as_str(),
        environment_id.map_or_else(String::new, |id| id.to_string()),
        normalized_key,
        rule_id.map_or_else(String::new, |id| id.to_string()),
        source_id.map_or_else(String::new, |id| id.to_string())
    );
    let digest = Sha256::digest(fingerprint_input.as_bytes());
    let mut fingerprint = String::with_capacity(digest.len() * 2);
    for byte in digest {
        write!(&mut fingerprint, "{byte:02x}").expect("writing to a String cannot fail");
    }

    DetectedIssue {
        fingerprint,
        environment_id,
        key_definition_id,
        rule_id,
        source_id,
        key_name,
        normalized_key,
        issue_type,
        severity,
        message,
        source_path,
        line_number,
        observed_name,
    }
}

fn normalize_key(key: &str) -> String {
    key.trim().to_ascii_uppercase()
}

fn severity_rank(severity: ValidationSeverity) -> u8 {
    match severity {
        ValidationSeverity::Info => 0,
        ValidationSeverity::Warning => 1,
        ValidationSeverity::Error => 2,
    }
}

fn environment_sort_key(
    environment_id: Option<Uuid>,
    environments: &HashMap<Uuid, &super::model::ValidationEnvironment>,
) -> (u32, String, Uuid) {
    environment_id
        .and_then(|id| {
            environments
                .get(&id)
                .map(|environment| (environment.sort_order, environment.name.clone(), id))
        })
        .unwrap_or((u32::MAX, String::new(), Uuid::nil()))
}
