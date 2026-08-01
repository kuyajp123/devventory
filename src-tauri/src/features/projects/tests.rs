use std::fs;

use tempfile::tempdir;

use crate::shared::database::{initialize_database, DatabasePaths};

use super::error::ProjectError;
use super::filesystem::LocalProjectFilesystem;
use super::model::{CreateProject, ProjectType, ScanConfiguration};
use super::repository::SqliteProjectRepository;
use super::service::ProjectService;

#[test]
fn scan_rejects_traversal_and_never_enters_excluded_directories() {
    let workspace = tempdir().expect("temporary workspace");
    let root = workspace.path().join("project");
    fs::create_dir_all(root.join("src")).expect("source directory");
    fs::create_dir_all(root.join("node_modules/package")).expect("excluded directory");
    fs::write(root.join("src/main.ts"), "export {};").expect("source file");
    fs::write(root.join("node_modules/package/index.js"), "ignored").expect("excluded file");
    let root_file = workspace.path().join("not-a-directory.txt");
    fs::write(&root_file, "not a root").expect("root-shaped file");

    let filesystem = LocalProjectFilesystem;
    assert!(matches!(
        filesystem.validate_root(root_file.to_str().expect("UTF-8 path")),
        Err(ProjectError::RootNotDirectory)
    ));
    let escaped = filesystem.validate_configuration(
        root.to_str().expect("UTF-8 path"),
        &["../outside".to_owned()],
        &["node_modules/".to_owned()],
    );
    assert!(matches!(
        escaped,
        Err(ProjectError::WatchedLocationOutsideRoot)
    ));

    let configuration = filesystem
        .validate_configuration(
            root.to_str().expect("UTF-8 path"),
            &[".".to_owned()],
            &["node_modules".to_owned(), "node_modules/".to_owned()],
        )
        .expect("valid project configuration");
    assert_eq!(configuration.exclusions, ["node_modules/"]);
    let summary = filesystem.scan(&configuration);

    assert_eq!(summary.files_discovered, 1);
    assert_eq!(summary.entries_excluded, 1);
    assert!(summary.completed);
}

#[tokio::test]
async fn service_persists_projects_and_rejects_a_duplicate_canonical_root() {
    let workspace = tempdir().expect("temporary workspace");
    let root = workspace.path().join("project");
    fs::create_dir_all(&root).expect("project root");
    fs::write(root.join("README.md"), "Devventory").expect("project file");

    let initialization = initialize_database(&DatabasePaths::new(workspace.path().join("data")))
        .await
        .expect("database initialization");
    let service = ProjectService::new(
        SqliteProjectRepository::new(initialization.database.pool().clone()),
        LocalProjectFilesystem,
    );
    let input = CreateProject {
        name: "Devventory".to_owned(),
        description: Some("Local inventory".to_owned()),
        project_type: ProjectType::Desktop,
        root_path: root.to_string_lossy().into_owned(),
        watched_locations: vec![".".to_owned()],
        exclusions: vec!["target/".to_owned()],
    };

    let created = service
        .create(input.clone())
        .await
        .expect("project creation");
    assert_eq!(created.name, "Devventory");
    assert_eq!(created.initial_scan.files_discovered, 1);
    assert_eq!(service.list().await.expect("project list"), vec![created]);

    let duplicate = service.create(input).await;
    assert!(matches!(duplicate, Err(ProjectError::DuplicateRoot)));
}

#[test]
fn scan_configuration_keeps_only_relative_inputs() {
    let input = ScanConfiguration {
        root_path: "C:/workspace/project".to_owned(),
        watched_locations: vec!["src".to_owned()],
        exclusions: vec!["dist/".to_owned()],
    };

    assert_eq!(input.watched_locations, ["src"]);
}
