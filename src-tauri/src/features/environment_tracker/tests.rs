use std::fs;

use tempfile::tempdir;
use uuid::Uuid;

use crate::features::file_inventory::{
    FileInventoryService, ScanType, SqliteFileInventoryRepository,
};
use crate::features::projects::{
    CreateProject, LocalProjectFilesystem, ProjectService, ProjectType, SqliteProjectRepository,
};
use crate::shared::database::{initialize_database, DatabasePaths};

use super::error::EnvironmentError;
use super::model::{MatrixCellState, MatrixQuery, SourceCandidateQuery, SourceStatus};
use super::repository::SqliteEnvironmentRepository;
use super::service::EnvironmentService;

#[tokio::test]
async fn persists_only_safe_environment_metadata_and_builds_a_bounded_matrix() {
    let workspace = tempdir().expect("temporary workspace");
    let root = workspace.path().join("project");
    fs::create_dir_all(&root).expect("project root");
    fs::write(
        root.join(".env"),
        "SUPABASE_URL=https://example.invalid\nSHARED=first-secret\nEMPTY=\n",
    )
    .expect("base environment file");
    fs::write(
        root.join(".env.local"),
        "export SHARED=second-secret\n# COMMENTED=hidden-secret\nINVALID-NAME=value\n",
    )
    .expect("local environment file");

    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    project_service
        .create(CreateProject {
            name: "Phase 6".to_owned(),
            description: None,
            project_type: ProjectType::Desktop,
            root_path: root.to_string_lossy().into_owned(),
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");
    let project_id = project_service.scan_targets().await.expect("targets")[0].id;
    FileInventoryService::new(
        SqliteFileInventoryRepository::new(pool.clone()),
        project_service.clone(),
    )
    .reconcile_project(project_id, ScanType::Initial)
    .await
    .expect("environment files indexed");

    let service = EnvironmentService::new(
        SqliteEnvironmentRepository::new(pool.clone()),
        project_service,
    );
    let development = service
        .create(
            project_id,
            "Development".to_owned(),
            Some("Local development".to_owned()),
        )
        .await
        .expect("environment creation");
    assert!(matches!(
        service
            .create(project_id, " development ".to_owned(), None)
            .await,
        Err(EnvironmentError::DuplicateName)
    ));

    let base_source = service
        .add_source(project_id, development.id, ".env".to_owned())
        .await
        .expect("base source");
    let local_source = service
        .add_source(project_id, development.id, ".env.local".to_owned())
        .await
        .expect("local source");
    assert_eq!(base_source.status, SourceStatus::Ready);
    assert_eq!(local_source.issue_count, 1);

    let candidates = service
        .source_candidates(SourceCandidateQuery {
            project_id,
            search: Some(".env".to_owned()),
            page: 1,
            page_size: 1,
        })
        .await
        .expect("bounded candidates");
    assert_eq!(candidates.items.len(), 1);
    assert_eq!(candidates.total_items, 2);
    assert_eq!(candidates.total_pages, 2);

    let matrix = service
        .matrix(MatrixQuery {
            project_id,
            search: None,
            page: 1,
            page_size: 2,
        })
        .await
        .expect("bounded matrix");
    assert_eq!(matrix.rows.len(), 2);
    assert!(matrix.total_items >= 4);
    assert!(matrix.total_pages >= 2);

    let shared = service
        .matrix(MatrixQuery {
            project_id,
            search: Some("SHARED".to_owned()),
            page: 1,
            page_size: 50,
        })
        .await
        .expect("duplicate matrix row");
    assert_eq!(shared.rows.len(), 1);
    assert_eq!(shared.rows[0].cells[0].state, MatrixCellState::Duplicate);
    assert_eq!(shared.rows[0].cells[0].duplicate_count, 2);

    let safe_payload = serde_json::to_string(&shared).expect("safe matrix payload");
    for secret in [
        "example.invalid",
        "first-secret",
        "second-secret",
        "hidden-secret",
    ] {
        assert!(!safe_payload.contains(secret));
    }

    let occurrence_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM environment_key_occurrences WHERE source_id = ?")
            .bind(base_source.id.to_string())
            .fetch_one(&pool)
            .await
            .expect("occurrence count");
    service
        .refresh_source(project_id, base_source.id)
        .await
        .expect("idempotent refresh");
    let repeated_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM environment_key_occurrences WHERE source_id = ?")
            .bind(base_source.id.to_string())
            .fetch_one(&pool)
            .await
            .expect("repeated occurrence count");
    assert_eq!(occurrence_count, repeated_count);

    let schema_columns = sqlx::query_scalar::<_, String>(
        "SELECT name FROM pragma_table_info('environment_key_occurrences')",
    )
    .fetch_all(&pool)
    .await
    .expect("occurrence schema");
    assert!(!schema_columns.iter().any(|column| column == "value"));

    fs::write(root.join(".env"), [0xff, b'=', b'x']).expect("invalid encoding fixture");
    service
        .refresh_source(project_id, base_source.id)
        .await
        .expect("safe parse failure");
    let preserved = service
        .matrix(MatrixQuery {
            project_id,
            search: Some("SUPABASE_URL".to_owned()),
            page: 1,
            page_size: 50,
        })
        .await
        .expect("previous occurrences preserved");
    assert_eq!(preserved.rows.len(), 1);

    let reordered = service
        .reorder_sources(
            project_id,
            development.id,
            vec![local_source.id, base_source.id],
        )
        .await
        .expect("source priority persisted");
    assert_eq!(reordered[0].id, local_source.id);
    assert_eq!(reordered[0].priority, 0);

    assert!(matches!(
        service
            .add_source(project_id, development.id, "../outside.env".to_owned())
            .await,
        Err(EnvironmentError::PathOutsideRoot)
    ));

    initialization.database.close().await;
}

#[tokio::test]
async fn keeps_environment_names_and_order_isolated_per_project() {
    let workspace = tempdir().expect("temporary workspace");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    let mut project_ids = Vec::new();
    for index in 0..2 {
        let root = workspace.path().join(format!("project-{index}"));
        fs::create_dir_all(&root).expect("project root");
        project_service
            .create(CreateProject {
                name: format!("Project {index}"),
                description: None,
                project_type: ProjectType::Other,
                root_path: root.to_string_lossy().into_owned(),
                watched_locations: vec![".".to_owned()],
                exclusions: vec![],
            })
            .await
            .expect("project creation");
    }
    project_ids.extend(
        project_service
            .scan_targets()
            .await
            .expect("targets")
            .into_iter()
            .map(|target| target.id),
    );
    let service = EnvironmentService::new(SqliteEnvironmentRepository::new(pool), project_service);
    let first = service
        .create(project_ids[0], "Production".to_owned(), None)
        .await
        .expect("first production");
    service
        .create(project_ids[1], "Production".to_owned(), None)
        .await
        .expect("same name in unrelated project");
    let staging = service
        .create(project_ids[0], "Staging".to_owned(), None)
        .await
        .expect("staging");
    let ordered = service
        .reorder_environments(project_ids[0], vec![staging.id, first.id])
        .await
        .expect("project-specific order");
    assert_eq!(ordered[0].name, "Staging");
    assert_eq!(
        service
            .list(project_ids[1])
            .await
            .expect("other project")
            .len(),
        1
    );

    initialization.database.close().await;
}

#[cfg(unix)]
#[tokio::test]
async fn rejects_symbolic_link_escape() {
    use std::os::unix::fs::symlink;

    let workspace = tempdir().expect("temporary workspace");
    let root = workspace.path().join("project");
    fs::create_dir_all(&root).expect("project root");
    let outside = workspace.path().join("outside.env");
    fs::write(&outside, "TOKEN=secret").expect("outside file");
    symlink(&outside, root.join("linked.env")).expect("symbolic link");

    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let pool = initialization.database.pool().clone();
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(pool.clone()),
        LocalProjectFilesystem,
    );
    project_service
        .create(CreateProject {
            name: "Symlink".to_owned(),
            description: None,
            project_type: ProjectType::Other,
            root_path: root.to_string_lossy().into_owned(),
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");
    let project_id = project_service.scan_targets().await.expect("targets")[0].id;
    let service = EnvironmentService::new(SqliteEnvironmentRepository::new(pool), project_service);
    let environment = service
        .create(project_id, "Local".to_owned(), None)
        .await
        .expect("environment");
    assert!(matches!(
        service
            .add_source(project_id, environment.id, "linked.env".to_owned())
            .await,
        Err(EnvironmentError::PathOutsideRoot)
    ));

    initialization.database.close().await;
}

#[test]
fn uuid_fixture_is_valid() {
    assert!(Uuid::parse_str("30af17bd-2dd6-4b89-a5e7-8517191815a7").is_ok());
}
