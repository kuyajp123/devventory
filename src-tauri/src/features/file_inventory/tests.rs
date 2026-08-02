use std::fs;

use tempfile::tempdir;

use crate::features::projects::{
    CreateProject, LocalProjectFilesystem, ProjectService, ProjectType, SqliteProjectRepository,
};
use crate::shared::database::{initialize_database, DatabasePaths};

use super::model::{FileCategory, FileStatus, InventoryQuery, ScanStatus, ScanType};
use super::repository::{FileInventoryRepository, SqliteFileInventoryRepository};
use super::service::FileInventoryService;

#[tokio::test]
async fn reconciles_persistent_metadata_and_recovers_missing_files() {
    let workspace = tempdir().expect("temporary workspace");
    let root = workspace.path().join("project");
    fs::create_dir_all(root.join("src")).expect("source directory");
    fs::create_dir_all(root.join("node_modules/pkg")).expect("excluded directory");
    fs::write(root.join("src/main.ts"), "export {};").expect("source file");
    fs::write(root.join("README.md"), "# Devventory").expect("document file");
    fs::write(root.join("node_modules/pkg/index.js"), "ignored").expect("excluded file");

    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(initialization.database.pool().clone()),
        LocalProjectFilesystem,
    );
    project_service
        .create(CreateProject {
            name: "Devventory".to_owned(),
            description: None,
            project_type: ProjectType::Desktop,
            root_path: root.to_string_lossy().into_owned(),
            watched_locations: vec![".".to_owned()],
            exclusions: vec!["node_modules/".to_owned()],
        })
        .await
        .expect("project creation");
    let project_id = project_service.scan_targets().await.expect("scan targets")[0].id;
    let repository = SqliteFileInventoryRepository::new(initialization.database.pool().clone());
    let inventory = FileInventoryService::new(repository.clone(), project_service);

    let initial = inventory
        .reconcile_project(project_id, ScanType::Initial)
        .await
        .expect("initial reconciliation");
    assert_eq!(initial.status, ScanStatus::Completed);
    assert_eq!(initial.files_discovered, 2);
    assert_eq!(initial.files_added, 2);
    assert_eq!(initial.entries_excluded, 1);

    let startup = inventory
        .reconcile_project(project_id, ScanType::Startup)
        .await
        .expect("idempotent startup reconciliation");
    assert_eq!(startup.scan_type, ScanType::Startup);
    assert_eq!(startup.files_added, 0);
    assert_eq!(startup.files_updated, 0);
    assert_eq!(startup.files_unchanged, 2);

    let first_page = inventory
        .query(query(project_id, None, None, 1, 1))
        .await
        .expect("first bounded page");
    assert_eq!(first_page.total_items, 2);
    assert_eq!(first_page.total_pages, 2);
    assert_eq!(first_page.items.len(), 1);
    let watched_location_id = first_page.watched_locations[0].id;
    let location_scan = inventory
        .reconcile_watched_location(project_id, watched_location_id)
        .await
        .expect("watched location reconciliation");
    assert_eq!(location_scan.scan_type, ScanType::ManualLocation);

    let source_page = inventory
        .query(query(project_id, Some(FileCategory::Source), None, 1, 1))
        .await
        .expect("source inventory");
    assert_eq!(source_page.total_items, 1);
    assert_eq!(source_page.items[0].relative_path, "src/main.ts");
    assert_eq!(source_page.total_pages, 1);

    let original_readme = inventory
        .query(query(project_id, None, None, 1, 10))
        .await
        .expect("complete inventory")
        .items
        .into_iter()
        .find(|file| file.relative_path == "README.md")
        .expect("README record");

    fs::write(root.join("src/main.ts"), "export const phase = 4;").expect("modified source file");
    fs::remove_file(root.join("README.md")).expect("remove README");
    fs::write(root.join("logo.png"), [0_u8, 1, 2, 3]).expect("new image");

    let changed = inventory
        .reconcile_project(project_id, ScanType::ManualProject)
        .await
        .expect("changed reconciliation");
    assert_eq!(changed.files_added, 1);
    assert_eq!(changed.files_updated, 1);
    assert_eq!(changed.files_missing, 1);

    let missing = inventory
        .query(query(project_id, None, Some(FileStatus::Missing), 1, 10))
        .await
        .expect("missing inventory");
    assert_eq!(missing.total_items, 1);
    assert_eq!(missing.items[0].id, original_readme.id);

    fs::write(root.join("README.md"), "# Returned").expect("recovered README");
    inventory
        .reconcile_project(project_id, ScanType::Watcher)
        .await
        .expect("recovery reconciliation");
    let recovered = inventory
        .query(InventoryQuery {
            project_id,
            search: Some("README".to_owned()),
            category: None,
            extension: None,
            status: Some(FileStatus::Active),
            page: 1,
            page_size: 10,
        })
        .await
        .expect("recovered inventory");
    assert_eq!(recovered.total_items, 1);
    assert_eq!(recovered.items[0].id, original_readme.id);

    fs::create_dir_all(root.join("assets")).expect("asset directory");
    fs::rename(root.join("logo.png"), root.join("assets/logo.png")).expect("move image");
    let moved = inventory
        .reconcile_project(project_id, ScanType::Watcher)
        .await
        .expect("move reconciliation");
    assert_eq!(moved.files_added, 1);
    assert_eq!(moved.files_missing, 1);
    let moved_file = inventory
        .query(InventoryQuery {
            project_id,
            search: Some("assets/logo.png".to_owned()),
            category: Some(FileCategory::Image),
            extension: Some("png".to_owned()),
            status: Some(FileStatus::Active),
            page: 1,
            page_size: 10,
        })
        .await
        .expect("moved file query");
    assert_eq!(moved_file.total_items, 1);

    fs::remove_dir_all(&root).expect("temporarily unavailable root");
    let unavailable = inventory
        .reconcile_project(project_id, ScanType::Startup)
        .await
        .expect("unavailable-root scan record");
    assert_eq!(unavailable.status, ScanStatus::Failed);
    let preserved = inventory
        .query(query(project_id, None, Some(FileStatus::Active), 1, 10))
        .await
        .expect("preserved inventory");
    assert_eq!(preserved.total_items, 3);

    initialization.database.close().await;
}

#[tokio::test]
async fn a_partial_scan_never_marks_unseen_records_missing() {
    let workspace = tempdir().expect("temporary workspace");
    let root = workspace.path().join("project");
    fs::create_dir_all(&root).expect("project root");
    fs::write(root.join("keep.txt"), "keep").expect("project file");
    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let project_service = ProjectService::new(
        SqliteProjectRepository::new(initialization.database.pool().clone()),
        LocalProjectFilesystem,
    );
    project_service
        .create(CreateProject {
            name: "Partial".to_owned(),
            description: None,
            project_type: ProjectType::Other,
            root_path: root.to_string_lossy().into_owned(),
            watched_locations: vec![".".to_owned()],
            exclusions: vec![],
        })
        .await
        .expect("project creation");
    let project_id = project_service.scan_targets().await.expect("targets")[0].id;
    let repository = SqliteFileInventoryRepository::new(initialization.database.pool().clone());
    let inventory = FileInventoryService::new(repository.clone(), project_service);
    inventory
        .reconcile_project(project_id, ScanType::Initial)
        .await
        .expect("initial scan");

    let scan_id = repository
        .start_scan(project_id, None, ScanType::ManualProject)
        .await
        .expect("partial scan start");
    let partial = repository
        .finish_scan(
            scan_id,
            project_id,
            None,
            super::model::ScanTraversalSummary {
                completed: false,
                entries_unreadable: 1,
                ..Default::default()
            },
            Default::default(),
        )
        .await
        .expect("partial scan finish");
    assert_eq!(partial.status, ScanStatus::Partial);
    assert_eq!(partial.files_missing, 0);

    let active = inventory
        .query(query(project_id, None, Some(FileStatus::Active), 1, 10))
        .await
        .expect("active inventory");
    assert_eq!(active.total_items, 1);

    initialization.database.close().await;
}

fn query(
    project_id: uuid::Uuid,
    category: Option<FileCategory>,
    status: Option<FileStatus>,
    page: u32,
    page_size: u32,
) -> InventoryQuery {
    InventoryQuery {
        project_id,
        search: None,
        category,
        extension: None,
        status,
        page,
        page_size,
    }
}
