//! The metadata wire boundary shared by the three publishing features.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Row, SqliteConnection};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CloudRecord {
    pub(crate) kind: String,
    pub(crate) id: String,
    pub(crate) data: Value,
}
impl CloudRecord {
    pub(crate) fn new(kind: &str, id: impl Into<String>, data: Value) -> Self {
        Self {
            kind: kind.to_owned(),
            id: id.into(),
            data,
        }
    }
}
pub(crate) async fn select_records(
    connection: &mut SqliteConnection,
    kind: &str,
    statement: &'static str,
    bindings: &[&str],
) -> Result<Vec<CloudRecord>, sqlx::Error> {
    let mut query = sqlx::query(statement);
    for value in bindings {
        query = query.bind(value);
    }
    query
        .fetch_all(connection)
        .await?
        .into_iter()
        .map(|row| {
            let id: String = row.try_get("id")?;
            let payload: String = row.try_get("payload")?;
            let data = serde_json::from_str(&payload)
                .map_err(|error| sqlx::Error::Decode(Box::new(error)))?;
            Ok(CloudRecord::new(kind, id, data))
        })
        .collect()
}
pub(crate) fn file_display_name(path: &str) -> String {
    path.rsplit(['/', '\\'])
        .next()
        .unwrap_or("Source")
        .to_owned()
}
