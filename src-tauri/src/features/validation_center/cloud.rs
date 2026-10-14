use crate::shared::cloud::{select_records, CloudRecord};
use serde_json::json;
use sqlx::SqliteConnection;

pub(crate) async fn cloud_records(
    connection: &mut SqliteConnection,
    project_id: &str,
) -> Result<Vec<CloudRecord>, sqlx::Error> {
    let mut records=select_records(connection,"rule", "SELECT id,json_object('id',id,'keyName',key_name,'ruleType',rule_type,'severity',severity,'description',description,'sortOrder',sort_order,'enabled',json(CASE WHEN enabled=1 THEN 'true' ELSE 'false' END),'createdAt',created_at,'updatedAt',updated_at) AS payload FROM environment_key_rules WHERE project_id=? ORDER BY id",&[project_id]).await?;
    records.extend(select_records(connection,"ruleTarget", "SELECT rule_id||':'||environment_id AS id,json_object('ruleId',rule_id,'environmentId',environment_id) AS payload FROM environment_key_rule_targets WHERE project_id=? ORDER BY rule_id,environment_id",&[project_id]).await?);
    records.extend(select_records(connection,"issue", "SELECT id,json_object('id',id,'environmentId',environment_id,'ruleId',rule_id,'keyName',key_name,'issueType',issue_type,'severity',severity,'status',status,'lineNumber',line_number,'firstSeenAt',first_seen_at,'lastSeenAt',last_seen_at,'resolvedAt',resolved_at,'updatedAt',updated_at) AS payload FROM validation_issues WHERE project_id=? ORDER BY id",&[project_id]).await?);
    let mut health=select_records(connection,"validation","SELECT project_id AS id,json_object('health',health,'lastSuccessfulAt',last_successful_at) AS payload FROM project_validation_state WHERE project_id=?",&[project_id]).await?;
    if health.is_empty() {
        health.push(CloudRecord::new(
            "validation",
            project_id,
            json!({"health":"unknown","lastSuccessfulAt":null}),
        ));
    }
    records.extend(health);
    Ok(records)
}
