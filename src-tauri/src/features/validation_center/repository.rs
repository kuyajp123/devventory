use std::collections::{HashMap, HashSet};

use sqlx::{FromRow, QueryBuilder, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use super::{
    domain::calculate_health,
    error::ValidationError,
    model::{
        DetectedIssue, EnvironmentHealth, SaveValidationRule, ValidationEnvironment,
        ValidationEvaluation, ValidationIssue, ValidationIssuePage, ValidationIssueQuery,
        ValidationIssueSort, ValidationIssueStatus, ValidationIssueType, ValidationOccurrence,
        ValidationRule, ValidationRuleType, ValidationSeverity, ValidationSnapshot,
        ValidationSource, ValidationSourceStatus, ValidationSummary,
    },
};

const MAX_RULES: i64 = 500;

#[derive(Debug, Clone)]
pub(crate) struct SqliteValidationRepository {
    pool: SqlitePool,
}

impl SqliteValidationRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub(crate) async fn list_rules(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<ValidationRule>, ValidationError> {
        let rows = sqlx::query_as::<_, RuleRow>(
            "SELECT id, project_id, key_name, rule_type, severity, description, sort_order,
                    enabled, created_at, updated_at
             FROM environment_key_rules
             WHERE project_id = ?
             ORDER BY sort_order ASC, lower(key_name) ASC, id ASC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?;
        let targets = sqlx::query_as::<_, RuleTargetRow>(
            "SELECT rule_id, environment_id FROM environment_key_rule_targets
             WHERE project_id = ? ORDER BY rule_id ASC, environment_id ASC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .try_fold(
            HashMap::<Uuid, Vec<Uuid>>::new(),
            |mut groups, row| -> Result<_, ValidationError> {
                groups
                    .entry(parse_uuid(&row.rule_id)?)
                    .or_default()
                    .push(parse_uuid(&row.environment_id)?);
                Ok(groups)
            },
        )?;

        rows.into_iter()
            .map(|row| {
                let rule_id = row.id()?;
                row.into_rule(targets.get(&rule_id).cloned().unwrap_or_default())
            })
            .collect()
    }

    pub(crate) async fn save_rule(
        &self,
        input: SaveValidationRule,
    ) -> Result<ValidationRule, ValidationError> {
        self.ensure_project_environments(input.project_id, &input.environment_ids)
            .await?;
        self.ensure_rule_targets_available(
            input.project_id,
            input.rule_id,
            &normalize_key(&input.key_name),
            &input.environment_ids,
        )
        .await?;
        if input.rule_id.is_none() {
            let count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM environment_key_rules WHERE project_id = ?",
            )
            .bind(input.project_id.to_string())
            .fetch_one(&self.pool)
            .await?;
            if count >= MAX_RULES {
                return Err(ValidationError::InvalidInput);
            }
        }

        let rule_id = input.rule_id.unwrap_or_else(Uuid::new_v4);
        let mut transaction = self.pool.begin().await?;
        let result = if input.rule_id.is_some() {
            sqlx::query(
                "UPDATE environment_key_rules SET key_name = ?, normalized_key = ?, rule_type = ?,
                        severity = ?, description = ?, enabled = ?,
                        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ? AND project_id = ?",
            )
            .bind(&input.key_name)
            .bind(normalize_key(&input.key_name))
            .bind(input.rule_type.as_str())
            .bind(input.severity.as_str())
            .bind(input.description.as_deref())
            .bind(input.enabled)
            .bind(rule_id.to_string())
            .bind(input.project_id.to_string())
            .execute(&mut *transaction)
            .await
        } else {
            let sort_order: i64 = sqlx::query_scalar(
                "SELECT COALESCE(MAX(sort_order) + 1, 0) FROM environment_key_rules
                 WHERE project_id = ?",
            )
            .bind(input.project_id.to_string())
            .fetch_one(&mut *transaction)
            .await?;
            sqlx::query(
                "INSERT INTO environment_key_rules (
                    id, project_id, key_name, normalized_key, rule_type, severity,
                    description, sort_order, enabled
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(rule_id.to_string())
            .bind(input.project_id.to_string())
            .bind(&input.key_name)
            .bind(normalize_key(&input.key_name))
            .bind(input.rule_type.as_str())
            .bind(input.severity.as_str())
            .bind(input.description.as_deref())
            .bind(sort_order)
            .bind(input.enabled)
            .execute(&mut *transaction)
            .await
        };
        let result = match result {
            Ok(result) => result,
            Err(error) if is_unique_violation(&error) => {
                return Err(ValidationError::DuplicateRule)
            }
            Err(error) => return Err(error.into()),
        };
        if input.rule_id.is_some() && result.rows_affected() == 0 {
            return Err(ValidationError::RuleNotFound);
        }

        sqlx::query(
            "DELETE FROM environment_key_rule_targets WHERE project_id = ? AND rule_id = ?",
        )
        .bind(input.project_id.to_string())
        .bind(rule_id.to_string())
        .execute(&mut *transaction)
        .await?;
        for environment_id in &input.environment_ids {
            sqlx::query(
                "INSERT INTO environment_key_rule_targets (project_id, rule_id, environment_id)
                 VALUES (?, ?, ?)",
            )
            .bind(input.project_id.to_string())
            .bind(rule_id.to_string())
            .bind(environment_id.to_string())
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;

        self.rule(input.project_id, rule_id).await
    }

    pub(crate) async fn delete_rule(
        &self,
        project_id: Uuid,
        rule_id: Uuid,
    ) -> Result<(), ValidationError> {
        let result =
            sqlx::query("DELETE FROM environment_key_rules WHERE project_id = ? AND id = ?")
                .bind(project_id.to_string())
                .bind(rule_id.to_string())
                .execute(&self.pool)
                .await?;
        if result.rows_affected() == 0 {
            return Err(ValidationError::RuleNotFound);
        }
        Ok(())
    }

    pub(crate) async fn reorder_rules(
        &self,
        project_id: Uuid,
        rule_ids: &[Uuid],
    ) -> Result<(), ValidationError> {
        let existing = self.list_rules(project_id).await?;
        ensure_exact_ids(existing.iter().map(|rule| rule.id), rule_ids)?;
        let mut transaction = self.pool.begin().await?;
        for (index, rule_id) in rule_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE environment_key_rules SET sort_order = ?,
                        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE project_id = ? AND id = ?",
            )
            .bind(i64::try_from(index).map_err(|_| ValidationError::InvalidInput)?)
            .bind(project_id.to_string())
            .bind(rule_id.to_string())
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub(super) async fn load_snapshot(
        &self,
        project_id: Uuid,
    ) -> Result<ValidationSnapshot, ValidationError> {
        let environments = sqlx::query_as::<_, ValidationEnvironmentRow>(
            "SELECT id, name, sort_order FROM environments
             WHERE project_id = ? ORDER BY sort_order ASC, id ASC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect::<Result<_, _>>()?;
        let sources = sqlx::query_as::<_, ValidationSourceRow>(
            "SELECT id, environment_id, relative_path, parse_status, last_issue_code, last_issue_line
             FROM environment_sources WHERE project_id = ? ORDER BY id ASC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect::<Result<_, _>>()?;
        let occurrences = sqlx::query_as::<_, ValidationOccurrenceRow>(
            "SELECT o.key_definition_id, o.environment_id, o.source_id, d.name AS key_name,
                    COALESCE(o.observed_name, d.name) AS observed_name,
                    d.normalized_name AS normalized_key, o.line_number, o.is_commented,
                    o.is_duplicate
             FROM environment_key_occurrences o
             JOIN environment_key_definitions d
               ON d.project_id = o.project_id AND d.id = o.key_definition_id
             WHERE o.project_id = ?
             UNION ALL
             SELECT l.key_definition_id, e.environment_id, c.source_id, d.name AS key_name,
                    c.key_name AS observed_name, d.normalized_name AS normalized_key,
                    NULL AS line_number, 0 AS is_commented, 0 AS is_duplicate
             FROM credential_project_links l
             JOIN credentials c ON c.id = l.credential_id
             JOIN credential_environment_links e
               ON e.credential_id = l.credential_id AND e.project_id = l.project_id
             JOIN environment_key_definitions d
               ON d.project_id = l.project_id AND d.id = l.key_definition_id
             WHERE l.project_id = ?
             ORDER BY source_id ASC, line_number ASC",
        )
        .bind(project_id.to_string())
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect::<Result<_, _>>()?;
        let rules = self.list_rules(project_id).await?;

        Ok(ValidationSnapshot {
            project_id,
            environments,
            sources,
            occurrences,
            rules,
        })
    }

    pub(super) async fn persist_evaluation(
        &self,
        project_id: Uuid,
        evaluation: &ValidationEvaluation,
    ) -> Result<(u64, ValidationSummary), ValidationError> {
        let run_id = Uuid::new_v4();
        let mut transaction = self.pool.begin().await?;
        for issue in &evaluation.issues {
            upsert_issue(&mut transaction, project_id, run_id, issue).await?;
        }
        let resolved = sqlx::query(
            "UPDATE validation_issues SET status = 'resolved',
                    resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE project_id = ? AND status != 'resolved' AND last_seen_run_id != ?",
        )
        .bind(project_id.to_string())
        .bind(run_id.to_string())
        .execute(&mut *transaction)
        .await?
        .rows_affected();

        let health = health_in_transaction(&mut transaction, project_id).await?;
        sqlx::query(
            "INSERT INTO project_validation_state (project_id, health, last_successful_at)
             VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(project_id) DO UPDATE SET
                health = excluded.health,
                last_successful_at = excluded.last_successful_at,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        )
        .bind(project_id.to_string())
        .bind(health.as_str())
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;

        Ok((resolved, self.summary(project_id).await?))
    }

    pub(crate) async fn list_issues(
        &self,
        query: &ValidationIssueQuery,
    ) -> Result<ValidationIssuePage, ValidationError> {
        let mut count = QueryBuilder::<Sqlite>::new(
            "SELECT COUNT(*) FROM validation_issues i LEFT JOIN environments e
             ON e.project_id = i.project_id AND e.id = i.environment_id
             LEFT JOIN environment_key_rules r
             ON r.project_id = i.project_id AND r.id = i.rule_id
             WHERE i.project_id = ",
        );
        push_issue_filters(&mut count, query);
        let total_items = to_u64(count.build_query_scalar().fetch_one(&self.pool).await?)?;

        let mut items = QueryBuilder::<Sqlite>::new(
            "SELECT i.id, i.project_id, i.environment_id, e.name AS environment_name,
                    i.rule_id, i.key_name, i.issue_type, i.severity, i.status, i.message,
                    i.source_path, i.line_number, i.observed_name, i.first_seen_at,
                    i.last_seen_at, i.resolved_at, i.updated_at
             FROM validation_issues i LEFT JOIN environments e
               ON e.project_id = i.project_id AND e.id = i.environment_id
             LEFT JOIN environment_key_rules r
               ON r.project_id = i.project_id AND r.id = i.rule_id
             WHERE i.project_id = ",
        );
        push_issue_filters(&mut items, query);
        push_issue_sort(&mut items, query.sort, query.descending);
        items.push(" LIMIT ");
        items.push_bind(i64::from(query.page_size));
        items.push(" OFFSET ");
        items.push_bind(to_i64(
            u64::from(query.page.saturating_sub(1)) * u64::from(query.page_size),
        )?);
        let items = items
            .build_query_as::<ValidationIssueRow>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(TryInto::try_into)
            .collect::<Result<_, _>>()?;

        Ok(ValidationIssuePage {
            items,
            total_items,
            page: query.page,
            page_size: query.page_size,
            total_pages: total_items
                .div_ceil(u64::from(query.page_size))
                .try_into()
                .map_err(|_| ValidationError::InvalidPersistedData)?,
        })
    }

    pub(crate) async fn open_matrix_issues(
        &self,
        project_id: Uuid,
        normalized_keys: &[String],
        environment_ids: &[Uuid],
    ) -> Result<Vec<ValidationIssue>, ValidationError> {
        if normalized_keys.is_empty() || environment_ids.is_empty() {
            return Ok(Vec::new());
        }

        let normalized_keys_json =
            serde_json::to_string(normalized_keys).map_err(|_| ValidationError::InvalidInput)?;
        let environment_ids_json = serde_json::to_string(
            &environment_ids
                .iter()
                .map(Uuid::to_string)
                .collect::<Vec<_>>(),
        )
        .map_err(|_| ValidationError::InvalidInput)?;

        sqlx::query_as::<_, ValidationIssueRow>(
            "SELECT i.id, i.project_id, i.environment_id, e.name AS environment_name,
                    i.rule_id, i.key_name, i.issue_type, i.severity, i.status, i.message,
                    i.source_path, i.line_number, i.observed_name, i.first_seen_at,
                    i.last_seen_at, i.resolved_at, i.updated_at
             FROM validation_issues i
             LEFT JOIN environments e
               ON e.project_id = i.project_id AND e.id = i.environment_id
             WHERE i.project_id = ? AND i.status = 'open'
               AND i.normalized_key IN (SELECT value FROM json_each(?))
               AND i.environment_id IN (SELECT value FROM json_each(?))
             ORDER BY CASE i.severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                      i.updated_at DESC, i.id ASC",
        )
        .bind(project_id.to_string())
        .bind(normalized_keys_json)
        .bind(environment_ids_json)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
    }

    pub(crate) async fn set_issue_status(
        &self,
        project_id: Uuid,
        issue_id: Uuid,
        status: ValidationIssueStatus,
    ) -> Result<ValidationIssue, ValidationError> {
        if status == ValidationIssueStatus::Resolved {
            return Err(ValidationError::InvalidInput);
        }
        let mut transaction = self.pool.begin().await?;
        let result = sqlx::query(
            "UPDATE validation_issues SET status = ?, resolved_at = NULL,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE project_id = ? AND id = ?",
        )
        .bind(status.as_str())
        .bind(project_id.to_string())
        .bind(issue_id.to_string())
        .execute(&mut *transaction)
        .await?;
        if result.rows_affected() == 0 {
            return Err(ValidationError::IssueNotFound);
        }
        let health = health_in_transaction(&mut transaction, project_id).await?;
        sqlx::query(
            "UPDATE project_validation_state SET health = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE project_id = ?",
        )
        .bind(health.as_str())
        .bind(project_id.to_string())
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        self.issue(project_id, issue_id).await
    }

    pub(crate) async fn summary(
        &self,
        project_id: Uuid,
    ) -> Result<ValidationSummary, ValidationError> {
        let row = sqlx::query_as::<_, SummaryRow>(
            "SELECT
                COALESCE(SUM(CASE WHEN i.status = 'open' THEN 1 ELSE 0 END), 0) AS open_issues,
                COALESCE(SUM(CASE WHEN i.status = 'open' AND i.severity = 'error' THEN 1 ELSE 0 END), 0) AS error_issues,
                COALESCE(SUM(CASE WHEN i.status = 'open' AND i.severity = 'warning' THEN 1 ELSE 0 END), 0) AS warning_issues,
                COALESCE(SUM(CASE WHEN i.status = 'open' AND i.severity = 'info' THEN 1 ELSE 0 END), 0) AS info_issues,
                COALESCE(SUM(CASE WHEN i.status = 'ignored' THEN 1 ELSE 0 END), 0) AS ignored_issues,
                COALESCE(SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END), 0) AS resolved_issues,
                s.health, s.last_successful_at
             FROM (SELECT ? AS project_id) p
             LEFT JOIN validation_issues i ON i.project_id = p.project_id
             LEFT JOIN project_validation_state s ON s.project_id = p.project_id",
        )
        .bind(project_id.to_string())
        .fetch_one(&self.pool)
        .await?;
        row.try_into()
    }

    pub(crate) async fn manifest_definitions(
        &self,
        project_id: Uuid,
    ) -> Result<Vec<(String, String)>, ValidationError> {
        sqlx::query_as::<_, DefinitionRow>(
            "SELECT name, normalized_name FROM environment_key_definitions
             WHERE project_id = ? ORDER BY normalized_name ASC, id ASC",
        )
        .bind(project_id.to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(Into::into)
        .map(|rows| {
            rows.into_iter()
                .map(|row| (row.name, row.normalized_name))
                .collect()
        })
    }

    async fn rule(
        &self,
        project_id: Uuid,
        rule_id: Uuid,
    ) -> Result<ValidationRule, ValidationError> {
        self.list_rules(project_id)
            .await?
            .into_iter()
            .find(|rule| rule.id == rule_id)
            .ok_or(ValidationError::RuleNotFound)
    }

    async fn issue(
        &self,
        project_id: Uuid,
        issue_id: Uuid,
    ) -> Result<ValidationIssue, ValidationError> {
        sqlx::query_as::<_, ValidationIssueRow>(
            "SELECT i.id, i.project_id, i.environment_id, e.name AS environment_name,
                    i.rule_id, i.key_name, i.issue_type, i.severity, i.status, i.message,
                    i.source_path, i.line_number, i.observed_name, i.first_seen_at,
                    i.last_seen_at, i.resolved_at, i.updated_at
             FROM validation_issues i LEFT JOIN environments e
               ON e.project_id = i.project_id AND e.id = i.environment_id
             WHERE i.project_id = ? AND i.id = ?",
        )
        .bind(project_id.to_string())
        .bind(issue_id.to_string())
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ValidationError::IssueNotFound)?
        .try_into()
    }

    async fn ensure_project_environments(
        &self,
        project_id: Uuid,
        environment_ids: &[Uuid],
    ) -> Result<(), ValidationError> {
        let mut query =
            QueryBuilder::<Sqlite>::new("SELECT id FROM environments WHERE project_id = ");
        query.push_bind(project_id.to_string());
        query.push(" AND id IN (");
        let mut separated = query.separated(", ");
        for id in environment_ids {
            separated.push_bind(id.to_string());
        }
        separated.push_unseparated(")");
        let existing = query
            .build_query_scalar::<String>()
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|value| parse_uuid(&value))
            .collect::<Result<HashSet<_>, _>>()?;
        if existing != environment_ids.iter().copied().collect() {
            return Err(ValidationError::InvalidInput);
        }
        Ok(())
    }

    async fn ensure_rule_targets_available(
        &self,
        project_id: Uuid,
        rule_id: Option<Uuid>,
        normalized_key: &str,
        environment_ids: &[Uuid],
    ) -> Result<(), ValidationError> {
        let mut query = QueryBuilder::<Sqlite>::new(
            "SELECT COUNT(*) FROM environment_key_rules r
             JOIN environment_key_rule_targets t
               ON t.project_id = r.project_id AND t.rule_id = r.id
             WHERE r.project_id = ",
        );
        query.push_bind(project_id.to_string());
        query.push(" AND r.normalized_key = ");
        query.push_bind(normalized_key.to_owned());
        if let Some(rule_id) = rule_id {
            query.push(" AND r.id != ");
            query.push_bind(rule_id.to_string());
        }
        query.push(" AND t.environment_id IN (");
        let mut separated = query.separated(", ");
        for environment_id in environment_ids {
            separated.push_bind(environment_id.to_string());
        }
        separated.push_unseparated(")");
        let count: i64 = query.build_query_scalar().fetch_one(&self.pool).await?;
        if count > 0 {
            return Err(ValidationError::DuplicateRule);
        }
        Ok(())
    }
}

async fn upsert_issue(
    transaction: &mut Transaction<'_, Sqlite>,
    project_id: Uuid,
    run_id: Uuid,
    issue: &DetectedIssue,
) -> Result<(), ValidationError> {
    sqlx::query(
        "INSERT INTO validation_issues (
            id, project_id, environment_id, key_definition_id, rule_id, source_id,
            fingerprint, key_name, normalized_key, issue_type, severity, status, message,
            source_path, line_number, observed_name, last_seen_run_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, fingerprint) DO UPDATE SET
            environment_id = excluded.environment_id,
            key_definition_id = excluded.key_definition_id,
            rule_id = excluded.rule_id,
            source_id = excluded.source_id,
            key_name = excluded.key_name,
            normalized_key = excluded.normalized_key,
            issue_type = excluded.issue_type,
            severity = excluded.severity,
            status = CASE
                WHEN validation_issues.status = 'ignored'
                 AND validation_issues.severity = excluded.severity
                 AND validation_issues.key_name = excluded.key_name
                 AND COALESCE(validation_issues.observed_name, '') = COALESCE(excluded.observed_name, '')
                THEN 'ignored'
                ELSE 'open'
            END,
            message = excluded.message,
            source_path = excluded.source_path,
            line_number = excluded.line_number,
            observed_name = excluded.observed_name,
            last_seen_run_id = excluded.last_seen_run_id,
            last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            resolved_at = NULL,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(project_id.to_string())
    .bind(issue.environment_id.map(|id| id.to_string()))
    .bind(issue.key_definition_id.map(|id| id.to_string()))
    .bind(issue.rule_id.map(|id| id.to_string()))
    .bind(issue.source_id.map(|id| id.to_string()))
    .bind(&issue.fingerprint)
    .bind(&issue.key_name)
    .bind(&issue.normalized_key)
    .bind(issue.issue_type.as_str())
    .bind(issue.severity.as_str())
    .bind(&issue.message)
    .bind(issue.source_path.as_deref())
    .bind(issue.line_number.map(i64::from))
    .bind(issue.observed_name.as_deref())
    .bind(run_id.to_string())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn health_in_transaction(
    transaction: &mut Transaction<'_, Sqlite>,
    project_id: Uuid,
) -> Result<EnvironmentHealth, ValidationError> {
    let rows = sqlx::query_as::<_, HealthRow>(
        "SELECT issue_type, status, severity FROM validation_issues WHERE project_id = ?",
    )
    .bind(project_id.to_string())
    .fetch_all(&mut **transaction)
    .await?;
    let parsed = rows
        .into_iter()
        .map(|row| row.parse())
        .collect::<Result<Vec<_>, _>>()?;
    Ok(calculate_health(parsed.iter().map(
        |(issue_type, status, severity)| (issue_type, *status, *severity),
    )))
}

fn push_issue_filters(query: &mut QueryBuilder<Sqlite>, filters: &ValidationIssueQuery) {
    query.push_bind(filters.project_id.to_string());
    if let Some(search) = filters.search.as_deref() {
        query.push(
            " AND instr(lower(i.key_name || ' ' || COALESCE(i.source_path, '') || ' ' || i.message), lower(",
        );
        query.push_bind(search);
        query.push(")) > 0");
    }
    if let Some(environment_id) = filters.environment_id {
        query.push(" AND i.environment_id = ");
        query.push_bind(environment_id.to_string());
    }
    if let Some(issue_type) = filters.issue_type {
        query.push(" AND i.issue_type = ");
        query.push_bind(issue_type.as_str());
    }
    if let Some(rule_type) = filters.rule_type {
        query.push(" AND r.rule_type = ");
        query.push_bind(rule_type.as_str());
    }
    if let Some(severity) = filters.severity {
        query.push(" AND i.severity = ");
        query.push_bind(severity.as_str());
    }
    if let Some(status) = filters.status {
        query.push(" AND i.status = ");
        query.push_bind(status.as_str());
    }
}

fn push_issue_sort(query: &mut QueryBuilder<Sqlite>, sort: ValidationIssueSort, descending: bool) {
    query.push(" ORDER BY ");
    match sort {
        ValidationIssueSort::UpdatedAt => query.push("i.updated_at"),
        ValidationIssueSort::Severity => {
            query.push("CASE i.severity WHEN 'error' THEN 2 WHEN 'warning' THEN 1 ELSE 0 END")
        }
        ValidationIssueSort::Key => query.push("lower(i.key_name)"),
        ValidationIssueSort::Environment => query.push("lower(COALESCE(e.name, ''))"),
        ValidationIssueSort::Status => query.push("i.status"),
    };
    if descending {
        query.push(" DESC");
    } else {
        query.push(" ASC");
    }
    query.push(", i.id ASC");
}

fn ensure_exact_ids(
    existing: impl IntoIterator<Item = Uuid>,
    requested: &[Uuid],
) -> Result<(), ValidationError> {
    let existing = existing.into_iter().collect::<HashSet<_>>();
    let requested_set = requested.iter().copied().collect::<HashSet<_>>();
    if existing.len() != requested.len() || existing != requested_set {
        return Err(ValidationError::InvalidInput);
    }
    Ok(())
}

fn normalize_key(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}

fn parse_uuid(value: &str) -> Result<Uuid, ValidationError> {
    Uuid::parse_str(value).map_err(|_| ValidationError::InvalidPersistedData)
}

fn parse_u32(value: i64) -> Result<u32, ValidationError> {
    value
        .try_into()
        .map_err(|_| ValidationError::InvalidPersistedData)
}

fn to_u64(value: i64) -> Result<u64, ValidationError> {
    value
        .try_into()
        .map_err(|_| ValidationError::InvalidPersistedData)
}

fn to_i64(value: u64) -> Result<i64, ValidationError> {
    value.try_into().map_err(|_| ValidationError::InvalidInput)
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database) if database.is_unique_violation())
}

#[derive(Debug, FromRow)]
struct RuleRow {
    id: String,
    project_id: String,
    key_name: String,
    rule_type: String,
    severity: String,
    description: Option<String>,
    sort_order: i64,
    enabled: bool,
    created_at: String,
    updated_at: String,
}

impl RuleRow {
    fn id(&self) -> Result<Uuid, ValidationError> {
        parse_uuid(&self.id)
    }

    fn into_rule(self, environment_ids: Vec<Uuid>) -> Result<ValidationRule, ValidationError> {
        Ok(ValidationRule {
            id: parse_uuid(&self.id)?,
            project_id: parse_uuid(&self.project_id)?,
            key_name: self.key_name,
            rule_type: ValidationRuleType::try_from(self.rule_type.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
            severity: ValidationSeverity::try_from(self.severity.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
            description: self.description,
            sort_order: parse_u32(self.sort_order)?,
            enabled: self.enabled,
            environment_ids,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct RuleTargetRow {
    rule_id: String,
    environment_id: String,
}

#[derive(Debug, FromRow)]
struct ValidationEnvironmentRow {
    id: String,
    name: String,
    sort_order: i64,
}

impl TryFrom<ValidationEnvironmentRow> for ValidationEnvironment {
    type Error = ValidationError;

    fn try_from(row: ValidationEnvironmentRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            name: row.name,
            sort_order: parse_u32(row.sort_order)?,
        })
    }
}

#[derive(Debug, FromRow)]
struct ValidationSourceRow {
    id: String,
    environment_id: String,
    relative_path: String,
    parse_status: String,
    last_issue_code: Option<String>,
    last_issue_line: Option<i64>,
}

impl TryFrom<ValidationSourceRow> for ValidationSource {
    type Error = ValidationError;

    fn try_from(row: ValidationSourceRow) -> Result<Self, Self::Error> {
        let status = match row.parse_status.as_str() {
            "parsed" => ValidationSourceStatus::Parsed,
            "missing" => ValidationSourceStatus::Missing,
            "unreadable" => ValidationSourceStatus::Unreadable,
            "parse_issue" => ValidationSourceStatus::ParseIssue,
            "unsupported_encoding" => ValidationSourceStatus::UnsupportedEncoding,
            "not_parsed" => ValidationSourceStatus::NotParsed,
            _ => return Err(ValidationError::InvalidPersistedData),
        };
        Ok(Self {
            id: parse_uuid(&row.id)?,
            environment_id: parse_uuid(&row.environment_id)?,
            relative_path: row.relative_path,
            status,
            issue_code: row.last_issue_code,
            issue_line: row.last_issue_line.map(parse_u32).transpose()?,
        })
    }
}

#[derive(Debug, FromRow)]
struct ValidationOccurrenceRow {
    key_definition_id: String,
    environment_id: String,
    source_id: String,
    key_name: String,
    observed_name: String,
    normalized_key: String,
    line_number: Option<i64>,
    is_commented: bool,
    is_duplicate: bool,
}

impl TryFrom<ValidationOccurrenceRow> for ValidationOccurrence {
    type Error = ValidationError;

    fn try_from(row: ValidationOccurrenceRow) -> Result<Self, Self::Error> {
        Ok(Self {
            key_definition_id: parse_uuid(&row.key_definition_id)?,
            environment_id: parse_uuid(&row.environment_id)?,
            source_id: parse_uuid(&row.source_id)?,
            key_name: row.key_name,
            observed_name: row.observed_name,
            normalized_key: row.normalized_key,
            line_number: row.line_number.map(parse_u32).transpose()?,
            is_commented: row.is_commented,
            is_duplicate: row.is_duplicate,
        })
    }
}

#[derive(Debug, FromRow)]
struct ValidationIssueRow {
    id: String,
    project_id: String,
    environment_id: Option<String>,
    environment_name: Option<String>,
    rule_id: Option<String>,
    key_name: String,
    issue_type: String,
    severity: String,
    status: String,
    message: String,
    source_path: Option<String>,
    line_number: Option<i64>,
    observed_name: Option<String>,
    first_seen_at: String,
    last_seen_at: String,
    resolved_at: Option<String>,
    updated_at: String,
}

impl TryFrom<ValidationIssueRow> for ValidationIssue {
    type Error = ValidationError;

    fn try_from(row: ValidationIssueRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: parse_uuid(&row.id)?,
            project_id: parse_uuid(&row.project_id)?,
            environment_id: row.environment_id.as_deref().map(parse_uuid).transpose()?,
            environment_name: row.environment_name,
            rule_id: row.rule_id.as_deref().map(parse_uuid).transpose()?,
            key_name: row.key_name,
            issue_type: ValidationIssueType::try_from(row.issue_type.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
            severity: ValidationSeverity::try_from(row.severity.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
            status: ValidationIssueStatus::try_from(row.status.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
            message: row.message,
            source_path: row.source_path,
            line_number: row.line_number.map(parse_u32).transpose()?,
            observed_name: row.observed_name,
            first_seen_at: row.first_seen_at,
            last_seen_at: row.last_seen_at,
            resolved_at: row.resolved_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct SummaryRow {
    open_issues: i64,
    error_issues: i64,
    warning_issues: i64,
    info_issues: i64,
    ignored_issues: i64,
    resolved_issues: i64,
    health: Option<String>,
    last_successful_at: Option<String>,
}

impl TryFrom<SummaryRow> for ValidationSummary {
    type Error = ValidationError;

    fn try_from(row: SummaryRow) -> Result<Self, Self::Error> {
        Ok(Self {
            health: row
                .health
                .as_deref()
                .map(EnvironmentHealth::try_from)
                .transpose()
                .map_err(|_| ValidationError::InvalidPersistedData)?
                .unwrap_or(EnvironmentHealth::Unknown),
            open_issues: to_u64(row.open_issues)?,
            error_issues: to_u64(row.error_issues)?,
            warning_issues: to_u64(row.warning_issues)?,
            info_issues: to_u64(row.info_issues)?,
            ignored_issues: to_u64(row.ignored_issues)?,
            resolved_issues: to_u64(row.resolved_issues)?,
            last_successful_at: row.last_successful_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct HealthRow {
    issue_type: String,
    status: String,
    severity: String,
}

impl HealthRow {
    fn parse(
        self,
    ) -> Result<
        (
            ValidationIssueType,
            ValidationIssueStatus,
            ValidationSeverity,
        ),
        ValidationError,
    > {
        Ok((
            ValidationIssueType::try_from(self.issue_type.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
            ValidationIssueStatus::try_from(self.status.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
            ValidationSeverity::try_from(self.severity.as_str())
                .map_err(|_| ValidationError::InvalidPersistedData)?,
        ))
    }
}

#[derive(Debug, FromRow)]
struct DefinitionRow {
    name: String,
    normalized_name: String,
}
