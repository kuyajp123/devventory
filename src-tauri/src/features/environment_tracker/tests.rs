use std::fs;
use std::path::PathBuf;

use sqlx::{query_scalar, SqlitePool};
use tempfile::{tempdir, TempDir};
use uuid::Uuid;

use crate::features::file_inventory::{
    FileInventoryService, ScanType, SqliteFileInventoryRepository,
};
use crate::features::projects::{
    CreateProject, LocalProjectFilesystem, ProjectService, ProjectType, SqliteProjectRepository,
};
use crate::shared::database::{initialize_database, DatabasePaths};

use super::error::EnvironmentError;
use super::model::{
    CreateEnvironment, EnvironmentMatrixCellState, EnvironmentMatrixQuery,
    EnvironmentSourceCandidateQuery, EnvironmentSourceParseStatus,
};
use super::parser::parse_environment_source;
use super::{dto::CreateEnvironmentInput, EnvironmentService, SqliteEnvironmentRepository};

struct TestContext {
    _workspace: TempDir,
    root: PathBuf,
    external: PathBuf,
    pool: SqlitePool,
    project_id: Uuid,
    inventory_service: FileInventoryService,
    service: EnvironmentService,
}

impl TestContext {
    async fn new() -> Self {
        let workspace = tempdir().expect("temporary workspace");
        let root = workspace.path().join("project");
        let external = workspace.path().join("external");
        fs::create_dir_all(&root).expect("project directory");
        fs::create_dir_all(&external).expect("external directory");
        let initialization =
            initialize_database(&DatabasePaths::new(workspace.path().join("data")))
                .await
                .expect("database initialization");
        let pool = initialization.database.pool().clone();
        let project_service = ProjectService::new(
            SqliteProjectRepository::new(pool.clone()),
            LocalProjectFilesystem,
        );
        project_service
            .create(CreateProject {
                name: "Environment project".to_owned(),
                description: None,
                project_type: ProjectType::Web,
                root_path: root.to_string_lossy().into_owned(),
                watched_locations: vec![".".to_owned()],
                exclusions: vec![],
            })
            .await
            .expect("project creation");
        let project_id = project_service
            .scan_targets()
            .await
            .expect("project scan targets")
            .into_iter()
            .next()
            .expect("persisted project")
            .id;
        let inventory_service = FileInventoryService::new(
            SqliteFileInventoryRepository::new(pool.clone()),
            project_service.clone(),
        );
        let service = EnvironmentService::new(
            SqliteEnvironmentRepository::new(pool.clone()),
            project_service,
        );
        Self {
            _workspace: workspace,
            root,
            external,
            pool,
            project_id,
            inventory_service,
            service,
        }
    }

    async fn environment(&self, name: &str) -> Uuid {
        self.service
            .create(CreateEnvironment {
                project_id: self.project_id,
                name: name.to_owned(),
                description: None,
            })
            .await
            .expect("environment creation")
            .id
    }

    fn write_source(&self, relative_path: &str, content: &[u8]) {
        let path = self.root.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("source parent");
        }
        fs::write(path, content).expect("source fixture");
    }
}

#[test]
fn parser_returns_only_key_metadata_for_active_and_commented_assignments() {
    let parsed = parse_environment_source(b"API_URL=x\n# FEATURE_FLAG=x\n")
        .expect("safe environment source fixture");

    assert_eq!(parsed.occurrences.len(), 2);
    assert_eq!(parsed.occurrences[0].name, "API_URL");
    assert_eq!(parsed.occurrences[0].line_number, 1);
    assert!(!parsed.occurrences[0].is_commented);
    assert_eq!(parsed.occurrences[1].name, "FEATURE_FLAG");
    assert_eq!(parsed.occurrences[1].line_number, 2);
    assert!(parsed.occurrences[1].is_commented);
}

#[test]
fn parser_rejects_invalid_encoding_and_never_returns_a_value_field() {
    let issue = parse_environment_source(&[0xff]).expect_err("invalid UTF-8 should be rejected");

    assert_eq!(issue.code.as_str(), "invalid_encoding");
    assert!(issue.line_number.is_none());
}

#[tokio::test]
async fn persists_only_environment_key_metadata_and_builds_a_priority_ordered_matrix() {
    let context = TestContext::new().await;
    context.write_source("config/base.env", b"SHARED_KEY=x\n# COMMENT_ONLY=x\n");
    context.write_source("config/local.env", b"SHARED_KEY=x\nLOCAL_KEY=x\n");
    let environment_id = context.environment("Local").await;

    context
        .service
        .add_source(
            context.project_id,
            environment_id,
            "config/base.env".to_owned(),
        )
        .await
        .expect("first source");
    context
        .service
        .add_source(
            context.project_id,
            environment_id,
            "config/local.env".to_owned(),
        )
        .await
        .expect("second source");

    let matrix = context
        .service
        .matrix(EnvironmentMatrixQuery {
            project_id: context.project_id,
            search: None,
            page: 1,
            page_size: 25,
        })
        .await
        .expect("environment matrix");
    let shared = matrix
        .rows
        .iter()
        .find(|row| row.key_name == "SHARED_KEY")
        .expect("shared key row");
    assert_eq!(shared.cells[0].state, EnvironmentMatrixCellState::Duplicate);
    assert_eq!(shared.cells[0].source_details.len(), 2);
    assert_eq!(
        shared.cells[0].source_details[0].relative_path,
        "config/base.env"
    );
    assert_eq!(
        shared.cells[0].source_details[1].relative_path,
        "config/local.env"
    );

    let columns: Vec<String> = query_scalar(
        "SELECT name FROM pragma_table_info('environment_key_occurrences') ORDER BY name",
    )
    .fetch_all(&context.pool)
    .await
    .expect("occurrence schema columns");
    assert!(!columns.iter().any(|column| column.contains("value")));
    assert!(!columns.iter().any(|column| column.contains("assignment")));
}

#[tokio::test]
async fn preserves_the_last_successful_occurrences_when_a_source_later_has_a_parse_issue() {
    let context = TestContext::new().await;
    context.write_source("config/local.env", b"STABLE_KEY=x\n");
    let environment_id = context.environment("Local").await;
    context
        .service
        .add_source(
            context.project_id,
            environment_id,
            "config/local.env".to_owned(),
        )
        .await
        .expect("source creation");

    context.write_source("config/local.env", b"BROKEN_LINE\n");
    context
        .service
        .refresh_environment(context.project_id, environment_id)
        .await
        .expect("refresh with parse issue");

    let sources = context
        .service
        .list_sources(context.project_id, environment_id)
        .await
        .expect("sources");
    assert_eq!(
        sources[0].parse_status,
        EnvironmentSourceParseStatus::ParseIssue
    );
    let matrix = context
        .service
        .matrix(EnvironmentMatrixQuery {
            project_id: context.project_id,
            search: Some("STABLE".to_owned()),
            page: 1,
            page_size: 25,
        })
        .await
        .expect("matrix after parse issue");
    assert_eq!(matrix.rows.len(), 1);
    assert_eq!(matrix.rows[0].key_name, "STABLE_KEY");
}

#[tokio::test]
async fn rejects_traversal_and_duplicate_sources_without_registering_external_paths() {
    let context = TestContext::new().await;
    fs::write(context.external.join("external.env"), b"OUTSIDE_KEY=x\n").expect("external fixture");
    context.write_source("config/local.env", b"LOCAL_KEY=x\n");
    let environment_id = context.environment("Local").await;

    let traversal = context
        .service
        .add_source(
            context.project_id,
            environment_id,
            "../external/external.env".to_owned(),
        )
        .await
        .expect_err("traversal should be rejected");
    assert!(matches!(traversal, EnvironmentError::ProjectFile(_)));
    assert!(context
        .service
        .list_sources(context.project_id, environment_id)
        .await
        .expect("sources")
        .is_empty());

    context
        .service
        .add_source(
            context.project_id,
            environment_id,
            "config/local.env".to_owned(),
        )
        .await
        .expect("first source");
    let duplicate = context
        .service
        .add_source(
            context.project_id,
            environment_id,
            "config/local.env".to_owned(),
        )
        .await
        .expect_err("duplicate source should conflict");
    assert!(matches!(duplicate, EnvironmentError::DuplicateSource));
}

#[tokio::test]
async fn searches_indexed_source_candidates_with_server_side_pagination() {
    let context = TestContext::new().await;
    context.write_source("config/base.env", b"BASE_KEY=x\n");
    context.write_source("config/local.env", b"LOCAL_KEY=x\n");
    context.write_source("src/application.rs", b"fn main() {}\n");
    context
        .inventory_service
        .reconcile_project(context.project_id, ScanType::ManualProject)
        .await
        .expect("inventory reconciliation");

    let first_page = context
        .service
        .source_candidates(EnvironmentSourceCandidateQuery {
            project_id: context.project_id,
            search: Some("config".to_owned()),
            page: 1,
            page_size: 1,
        })
        .await
        .expect("first candidate page");
    let second_page = context
        .service
        .source_candidates(EnvironmentSourceCandidateQuery {
            project_id: context.project_id,
            search: Some("config".to_owned()),
            page: 2,
            page_size: 1,
        })
        .await
        .expect("second candidate page");

    assert_eq!(first_page.total_items, 2);
    assert_eq!(first_page.total_pages, 2);
    assert_eq!(first_page.items.len(), 1);
    assert_eq!(second_page.items.len(), 1);
    assert_ne!(
        first_page.items[0].relative_path,
        second_page.items[0].relative_path
    );
}

#[tokio::test]
async fn creates_environment_with_blank_description() {
    let context = TestContext::new().await;
    let input: CreateEnvironmentInput = serde_json::from_value(serde_json::json!({
        "projectId": context.project_id,
        "name": "staging",
        "description": ""
    }))
    .expect("input should deserialize");

    let created = context
        .service
        .create(input.try_into().expect("input should validate"))
        .await
        .expect("environment should be created");

    assert_eq!(created.name, "staging");
    assert_eq!(created.description, None);
}

#[tokio::test]
async fn rejects_duplicate_environment_names() {
    let context = TestContext::new().await;
    context.environment("local").await;

    let error = context
        .service
        .create(CreateEnvironment {
            project_id: context.project_id,
            name: "Local".to_owned(),
            description: None,
        })
        .await
        .expect_err("duplicate environment names should be rejected");

    assert!(matches!(error, EnvironmentError::DuplicateEnvironment));
}
