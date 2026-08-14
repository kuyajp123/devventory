use std::collections::HashMap;

use sqlx::{FromRow, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use super::error::CredentialVaultError;
use super::model::{
    Credential, CredentialEnvironmentLink, NewCredentialSource, PreparedCredential,
    StoredCredentialSource, UpdateCredential, UpdateCredentialSource,
};

#[derive(Debug, Clone)]
pub(crate) struct SqliteCredentialVaultRepository {
    pool: SqlitePool,
}

impl SqliteCredentialVaultRepository {
    pub(crate) fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub(super) async fn list_sources(
        &self,
    ) -> Result<Vec<StoredCredentialSource>, CredentialVaultError> {
        let rows = sqlx::query_as::<_, SourceRow>(
            "SELECT s.id, s.definition_key, s.name, s.description, s.icon_file_name,
                    s.created_at, s.updated_at, COUNT(c.id) AS credential_count
             FROM credential_sources s
             LEFT JOIN credentials c ON c.source_id = s.id
             GROUP BY s.id
             ORDER BY s.sort_order, lower(s.name), s.created_at, s.id",
        )
        .fetch_all(&self.pool)
        .await?;
        let project_rows = sqlx::query_as::<_, SourceProjectRow>(
            "SELECT source_id, project_id FROM credential_source_projects
             ORDER BY source_id, project_id",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut projects = HashMap::<Uuid, Vec<Uuid>>::new();
        for row in project_rows {
            projects
                .entry(parse_uuid(&row.source_id)?)
                .or_default()
                .push(parse_uuid(&row.project_id)?);
        }
        rows.into_iter()
            .map(|row| {
                let id = parse_uuid(&row.id)?;
                Ok(StoredCredentialSource {
                    id,
                    definition_key: row.definition_key,
                    name: row.name,
                    description: row.description,
                    icon_file_name: row.icon_file_name,
                    project_ids: projects.remove(&id).unwrap_or_default(),
                    credential_count: u32::try_from(row.credential_count)
                        .map_err(|_| CredentialVaultError::InvalidPersistedData)?,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                })
            })
            .collect()
    }

    pub(crate) async fn create_source(
        &self,
        id: Uuid,
        input: &NewCredentialSource,
        icon_file_name: Option<&str>,
    ) -> Result<(), CredentialVaultError> {
        let mut transaction = self.pool.begin().await?;
        let sort_order: i64 =
            sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM credential_sources")
                .fetch_one(&mut *transaction)
                .await?;
        sqlx::query(
            "INSERT INTO credential_sources (
                id, definition_key, name, normalized_name, description,
                icon_file_name, sort_order
             ) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(&input.definition_key)
        .bind(&input.name)
        .bind(normalize_source_name(&input.name))
        .bind(&input.description)
        .bind(icon_file_name)
        .bind(sort_order)
        .execute(&mut *transaction)
        .await?;
        replace_source_projects(&mut transaction, id, &input.project_ids).await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn update_source(
        &self,
        input: &UpdateCredentialSource,
        icon_file_name: Option<&str>,
        replace_icon: bool,
    ) -> Result<(), CredentialVaultError> {
        let mut transaction = self.pool.begin().await?;
        let result = if replace_icon {
            sqlx::query(
                "UPDATE credential_sources
                 SET name = ?, normalized_name = ?, description = ?, icon_file_name = ?,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?",
            )
            .bind(&input.name)
            .bind(normalize_source_name(&input.name))
            .bind(&input.description)
            .bind(icon_file_name)
            .bind(input.source_id.to_string())
            .execute(&mut *transaction)
            .await?
        } else {
            sqlx::query(
                "UPDATE credential_sources
                 SET name = ?, normalized_name = ?, description = ?,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?",
            )
            .bind(&input.name)
            .bind(normalize_source_name(&input.name))
            .bind(&input.description)
            .bind(input.source_id.to_string())
            .execute(&mut *transaction)
            .await?
        };
        if result.rows_affected() != 1 {
            return Err(CredentialVaultError::SourceNotFound);
        }
        replace_source_projects(&mut transaction, input.source_id, &input.project_ids).await?;
        // A credential's specific project usage always implies broad source association.
        sqlx::query(
            "INSERT OR IGNORE INTO credential_source_projects (source_id, project_id)
             SELECT DISTINCT c.source_id, l.project_id
             FROM credentials c
             JOIN credential_project_links l ON l.credential_id = c.id
             WHERE c.source_id = ?",
        )
        .bind(input.source_id.to_string())
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn delete_source(
        &self,
        source_id: Uuid,
    ) -> Result<Vec<Uuid>, CredentialVaultError> {
        let mut transaction = self.pool.begin().await?;
        let secret_rows: Vec<Option<String>> =
            sqlx::query_scalar("SELECT secret_reference FROM credentials WHERE source_id = ?")
                .bind(source_id.to_string())
                .fetch_all(&mut *transaction)
                .await?;
        let project_rows: Vec<String> = sqlx::query_scalar(
            "SELECT DISTINCT l.project_id FROM credential_project_links l
             JOIN credentials c ON c.id = l.credential_id WHERE c.source_id = ?",
        )
        .bind(source_id.to_string())
        .fetch_all(&mut *transaction)
        .await?;
        let result = sqlx::query("DELETE FROM credential_sources WHERE id = ?")
            .bind(source_id.to_string())
            .execute(&mut *transaction)
            .await?;
        if result.rows_affected() != 1 {
            return Err(CredentialVaultError::SourceNotFound);
        }
        for project_id in project_rows {
            cleanup_orphaned_definitions(&mut transaction, &project_id).await?;
        }
        transaction.commit().await?;
        secret_rows
            .into_iter()
            .flatten()
            .map(|value| parse_uuid(&value))
            .collect()
    }

    pub(crate) async fn list_credentials(
        &self,
        source_id: Option<Uuid>,
    ) -> Result<Vec<Credential>, CredentialVaultError> {
        let rows = if let Some(source_id) = source_id {
            sqlx::query_as::<_, CredentialRow>(
                "SELECT id, source_id, key_name, normalized_key_name, notes,
                        secret_reference IS NOT NULL AS has_value, created_at, updated_at
                 FROM credentials WHERE source_id = ?
                 ORDER BY normalized_key_name, created_at, id",
            )
            .bind(source_id.to_string())
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, CredentialRow>(
                "SELECT id, source_id, key_name, normalized_key_name, notes,
                        secret_reference IS NOT NULL AS has_value, created_at, updated_at
                 FROM credentials ORDER BY normalized_key_name, created_at, id",
            )
            .fetch_all(&self.pool)
            .await?
        };
        let project_rows = sqlx::query_as::<_, CredentialProjectRow>(
            "SELECT credential_id, project_id FROM credential_project_links
             ORDER BY credential_id, project_id",
        )
        .fetch_all(&self.pool)
        .await?;
        let environment_rows = sqlx::query_as::<_, CredentialEnvironmentRow>(
            "SELECT credential_id, project_id, environment_id
             FROM credential_environment_links
             ORDER BY credential_id, project_id, environment_id",
        )
        .fetch_all(&self.pool)
        .await?;
        let mut projects = HashMap::<Uuid, Vec<Uuid>>::new();
        for row in project_rows {
            projects
                .entry(parse_uuid(&row.credential_id)?)
                .or_default()
                .push(parse_uuid(&row.project_id)?);
        }
        let mut environments = HashMap::<Uuid, Vec<CredentialEnvironmentLink>>::new();
        for row in environment_rows {
            environments
                .entry(parse_uuid(&row.credential_id)?)
                .or_default()
                .push(CredentialEnvironmentLink {
                    project_id: parse_uuid(&row.project_id)?,
                    environment_id: parse_uuid(&row.environment_id)?,
                });
        }
        rows.into_iter()
            .map(|row| {
                let id = parse_uuid(&row.id)?;
                Ok(Credential {
                    id,
                    source_id: parse_uuid(&row.source_id)?,
                    key: row.key_name,
                    normalized_key: row.normalized_key_name,
                    notes: row.notes,
                    has_value: row.has_value,
                    project_ids: projects.remove(&id).unwrap_or_default(),
                    environment_links: environments.remove(&id).unwrap_or_default(),
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                })
            })
            .collect()
    }

    pub(super) async fn create_credentials(
        &self,
        source_id: Uuid,
        credentials: &[PreparedCredential],
    ) -> Result<(), CredentialVaultError> {
        let mut transaction = self.pool.begin().await?;
        let source_exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM credential_sources WHERE id = ?)")
                .bind(source_id.to_string())
                .fetch_one(&mut *transaction)
                .await?;
        if !source_exists {
            return Err(CredentialVaultError::SourceNotFound);
        }
        for prepared in credentials {
            let item = &prepared.credential;
            let result = sqlx::query(
                "INSERT INTO credentials (
                    id, source_id, key_name, normalized_key_name, notes, secret_reference
                 ) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(prepared.id.to_string())
            .bind(source_id.to_string())
            .bind(&item.key)
            .bind(normalize_key_name(&item.key))
            .bind(&item.notes)
            .bind(prepared.secret_reference.map(|value| value.to_string()))
            .execute(&mut *transaction)
            .await;
            match result {
                Ok(_) => {}
                Err(error) if is_unique_violation(&error) => {
                    return Err(CredentialVaultError::DuplicateCredential)
                }
                Err(error) => return Err(error.into()),
            }
            replace_credential_links(
                &mut transaction,
                prepared.id,
                &item.key,
                &item.project_ids,
                &item.environment_links,
            )
            .await?;
            insert_source_projects(&mut transaction, source_id, &item.project_ids).await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn update_credential(
        &self,
        input: &UpdateCredential,
    ) -> Result<(), CredentialVaultError> {
        let mut transaction = self.pool.begin().await?;
        let previous_project_ids: Vec<String> = sqlx::query_scalar(
            "SELECT project_id FROM credential_project_links WHERE credential_id = ?",
        )
        .bind(input.credential_id.to_string())
        .fetch_all(&mut *transaction)
        .await?;
        let result = sqlx::query(
            "UPDATE credentials
             SET key_name = ?, normalized_key_name = ?, notes = ?,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?",
        )
        .bind(&input.key)
        .bind(normalize_key_name(&input.key))
        .bind(&input.notes)
        .bind(input.credential_id.to_string())
        .execute(&mut *transaction)
        .await;
        let result = match result {
            Ok(result) => result,
            Err(error) if is_unique_violation(&error) => {
                return Err(CredentialVaultError::DuplicateCredential)
            }
            Err(error) => return Err(error.into()),
        };
        if result.rows_affected() != 1 {
            return Err(CredentialVaultError::CredentialNotFound);
        }
        replace_credential_links(
            &mut transaction,
            input.credential_id,
            &input.key,
            &input.project_ids,
            &input.environment_links,
        )
        .await?;
        let source_id: String =
            sqlx::query_scalar("SELECT source_id FROM credentials WHERE id = ?")
                .bind(input.credential_id.to_string())
                .fetch_one(&mut *transaction)
                .await?;
        insert_source_projects(
            &mut transaction,
            parse_uuid(&source_id)?,
            &input.project_ids,
        )
        .await?;
        for project_id in previous_project_ids {
            cleanup_orphaned_definitions(&mut transaction, &project_id).await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    pub(crate) async fn secret_reference(
        &self,
        credential_id: Uuid,
    ) -> Result<Option<Uuid>, CredentialVaultError> {
        let value: Option<String> =
            sqlx::query_scalar("SELECT secret_reference FROM credentials WHERE id = ?")
                .bind(credential_id.to_string())
                .fetch_optional(&self.pool)
                .await?
                .ok_or(CredentialVaultError::CredentialNotFound)?;
        value.as_deref().map(parse_uuid).transpose()
    }

    pub(crate) async fn set_secret_reference(
        &self,
        credential_id: Uuid,
        reference: Option<Uuid>,
    ) -> Result<(), CredentialVaultError> {
        let result = sqlx::query(
            "UPDATE credentials SET secret_reference = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        )
        .bind(reference.map(|value| value.to_string()))
        .bind(credential_id.to_string())
        .execute(&self.pool)
        .await?;
        if result.rows_affected() != 1 {
            return Err(CredentialVaultError::CredentialNotFound);
        }
        Ok(())
    }

    pub(crate) async fn delete_credential(
        &self,
        credential_id: Uuid,
    ) -> Result<Option<Uuid>, CredentialVaultError> {
        let mut transaction = self.pool.begin().await?;
        let reference: Option<String> =
            sqlx::query_scalar("SELECT secret_reference FROM credentials WHERE id = ?")
                .bind(credential_id.to_string())
                .fetch_optional(&mut *transaction)
                .await?
                .ok_or(CredentialVaultError::CredentialNotFound)?;
        let project_rows: Vec<String> = sqlx::query_scalar(
            "SELECT project_id FROM credential_project_links WHERE credential_id = ?",
        )
        .bind(credential_id.to_string())
        .fetch_all(&mut *transaction)
        .await?;
        let result = sqlx::query("DELETE FROM credentials WHERE id = ?")
            .bind(credential_id.to_string())
            .execute(&mut *transaction)
            .await?;
        if result.rows_affected() != 1 {
            return Err(CredentialVaultError::CredentialNotFound);
        }
        for project_id in project_rows {
            cleanup_orphaned_definitions(&mut transaction, &project_id).await?;
        }
        transaction.commit().await?;
        reference.as_deref().map(parse_uuid).transpose()
    }
}

async fn replace_source_projects(
    transaction: &mut Transaction<'_, Sqlite>,
    source_id: Uuid,
    project_ids: &[Uuid],
) -> Result<(), CredentialVaultError> {
    sqlx::query("DELETE FROM credential_source_projects WHERE source_id = ?")
        .bind(source_id.to_string())
        .execute(&mut **transaction)
        .await?;
    insert_source_projects(transaction, source_id, project_ids).await
}

async fn insert_source_projects(
    transaction: &mut Transaction<'_, Sqlite>,
    source_id: Uuid,
    project_ids: &[Uuid],
) -> Result<(), CredentialVaultError> {
    for project_id in project_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO credential_source_projects (source_id, project_id)
             VALUES (?, ?)",
        )
        .bind(source_id.to_string())
        .bind(project_id.to_string())
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}

async fn replace_credential_links(
    transaction: &mut Transaction<'_, Sqlite>,
    credential_id: Uuid,
    key_name: &str,
    project_ids: &[Uuid],
    environment_links: &[CredentialEnvironmentLink],
) -> Result<(), CredentialVaultError> {
    sqlx::query("DELETE FROM credential_project_links WHERE credential_id = ?")
        .bind(credential_id.to_string())
        .execute(&mut **transaction)
        .await?;
    for project_id in project_ids {
        let definition_id =
            find_or_create_key_definition(transaction, *project_id, key_name).await?;
        sqlx::query(
            "INSERT INTO credential_project_links (
                credential_id, project_id, key_definition_id
             ) VALUES (?, ?, ?)",
        )
        .bind(credential_id.to_string())
        .bind(project_id.to_string())
        .bind(definition_id)
        .execute(&mut **transaction)
        .await?;
    }
    for link in environment_links {
        sqlx::query(
            "INSERT INTO credential_environment_links (
                credential_id, project_id, environment_id
             ) VALUES (?, ?, ?)",
        )
        .bind(credential_id.to_string())
        .bind(link.project_id.to_string())
        .bind(link.environment_id.to_string())
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}

async fn find_or_create_key_definition(
    transaction: &mut Transaction<'_, Sqlite>,
    project_id: Uuid,
    key_name: &str,
) -> Result<String, CredentialVaultError> {
    let normalized = normalize_key_name(key_name);
    sqlx::query(
        "INSERT INTO environment_key_definitions (id, project_id, name, normalized_name)
         VALUES (?, ?, ?, ?) ON CONFLICT(project_id, normalized_name) DO NOTHING",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(project_id.to_string())
    .bind(key_name)
    .bind(&normalized)
    .execute(&mut **transaction)
    .await?;
    Ok(sqlx::query_scalar(
        "SELECT id FROM environment_key_definitions
         WHERE project_id = ? AND normalized_name = ?",
    )
    .bind(project_id.to_string())
    .bind(normalized)
    .fetch_one(&mut **transaction)
    .await?)
}

async fn cleanup_orphaned_definitions(
    transaction: &mut Transaction<'_, Sqlite>,
    project_id: &str,
) -> Result<(), CredentialVaultError> {
    sqlx::query(
        "DELETE FROM environment_key_definitions WHERE project_id = ?
         AND NOT EXISTS (
            SELECT 1 FROM environment_key_occurrences o
            WHERE o.key_definition_id = environment_key_definitions.id
         ) AND NOT EXISTS (
            SELECT 1 FROM credential_project_links l
            WHERE l.key_definition_id = environment_key_definitions.id
         )",
    )
    .bind(project_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn normalize_source_name(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn normalize_key_name(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}

fn parse_uuid(value: &str) -> Result<Uuid, CredentialVaultError> {
    Uuid::parse_str(value).map_err(|_| CredentialVaultError::InvalidPersistedData)
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database) if database.is_unique_violation())
}

#[derive(Debug, FromRow)]
struct SourceRow {
    id: String,
    definition_key: Option<String>,
    name: String,
    description: Option<String>,
    icon_file_name: Option<String>,
    credential_count: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, FromRow)]
struct SourceProjectRow {
    source_id: String,
    project_id: String,
}

#[derive(Debug, FromRow)]
struct CredentialRow {
    id: String,
    source_id: String,
    key_name: String,
    normalized_key_name: String,
    notes: Option<String>,
    has_value: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, FromRow)]
struct CredentialProjectRow {
    credential_id: String,
    project_id: String,
}

#[derive(Debug, FromRow)]
struct CredentialEnvironmentRow {
    credential_id: String,
    project_id: String,
    environment_id: String,
}
