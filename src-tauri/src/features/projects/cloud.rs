use crate::shared::cloud::{select_records, CloudRecord};
use sqlx::SqliteConnection;

pub(crate) async fn cloud_records(
    connection: &mut SqliteConnection,
    project_id: &str,
) -> Result<Vec<CloudRecord>, sqlx::Error> {
    select_records(connection,"project", "SELECT id,json_object('id',id,'name',name,'description',description,'projectType',project_type,'createdAt',created_at,'updatedAt',updated_at) AS payload FROM projects WHERE id=?",&[project_id]).await
}
