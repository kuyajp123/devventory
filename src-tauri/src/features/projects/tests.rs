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
    fs::create_dir_all(root.join("packages/app/node_modules/package"))
        .expect("nested built-in exclusion directory");
    fs::write(root.join("src/main.ts"), "export {};").expect("source file");
    fs::write(root.join("node_modules/package/index.js"), "ignored").expect("excluded file");
    fs::write(
        root.join("packages/app/node_modules/package/index.js"),
        "ignored",
    )
    .expect("nested excluded file");
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
        .validate_configuration(root.to_str().expect("UTF-8 path"), &[".".to_owned()], &[])
        .expect("valid project configuration");
    assert!(configuration.exclusions.is_empty());
    let summary = filesystem.scan(&configuration);

    assert_eq!(summary.files_discovered, 1);
    assert_eq!(summary.entries_excluded, 2);
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
        exclusions: vec!["generated/".to_owned()],
    };

    let created = service
        .create(input.clone())
        .await
        .expect("project creation");
    assert_eq!(created.name, "Devventory");
    assert_eq!(created.initial_scan.files_discovered, 1);
    assert_eq!(
        service.list().await.expect("project list"),
        vec![created.clone()]
    );

    let target = service
        .scan_target(created.id)
        .await
        .expect("project scan target");
    assert_eq!(target.id, created.id);
    assert_eq!(target.root_path, created.root_path);
    assert_eq!(target.watched_locations.len(), 1);
    assert_eq!(target.watched_locations[0].relative_path, ".");
    assert_eq!(target.exclusions, ["generated/"]);
    assert_eq!(target.watched_locations[0].id.get_version_num(), 4);

    let duplicate = service.create(input).await;
    assert!(matches!(duplicate, Err(ProjectError::DuplicateRoot)));
}

#[tokio::test]
async fn deleting_a_project_removes_owned_metadata_without_touching_the_project_folder() {
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
    let project = service
        .create(CreateProject {
            name: "Disposable project".to_owned(),
            description: None,
            project_type: ProjectType::Desktop,
            root_path: root.to_string_lossy().into_owned(),
            watched_locations: vec![".".to_owned()],
            exclusions: vec!["target/".to_owned()],
        })
        .await
        .expect("project creation");
    sqlx::query(
        "INSERT INTO search_history (id, project_id, query_text, request_json)
         VALUES (?, ?, 'project query', ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(project.id.to_string())
    .bind(format!(
        "{{\"query\":\"project query\",\"projectId\":\"{}\"}}",
        project.id
    ))
    .execute(initialization.database.pool())
    .await
    .expect("project search history");

    service
        .delete(&project.id.to_string())
        .await
        .expect("project deletion");

    assert!(matches!(
        service.get(&project.id.to_string()).await,
        Err(ProjectError::ProjectNotFound)
    ));
    let owned_rows: i64 = sqlx::query_scalar(
        "SELECT
            (SELECT COUNT(*) FROM watched_locations WHERE project_id = ?)
          + (SELECT COUNT(*) FROM project_exclusions WHERE project_id = ?)
          + (SELECT COUNT(*) FROM initial_scan_summaries WHERE project_id = ?)",
    )
    .bind(project.id.to_string())
    .bind(project.id.to_string())
    .bind(project.id.to_string())
    .fetch_one(initialization.database.pool())
    .await
    .expect("owned row count");
    assert_eq!(owned_rows, 0);
    let search_history_rows: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM search_history WHERE project_id = ?")
            .bind(project.id.to_string())
            .fetch_one(initialization.database.pool())
            .await
            .expect("search history count");
    assert_eq!(search_history_rows, 0);
    assert!(root.join("README.md").is_file());
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

#[cfg(unix)]
#[test]
fn watched_locations_reject_symbolic_link_components() {
    use std::os::unix::fs::symlink;

    let workspace = tempdir().expect("temporary workspace");
    let root = workspace.path().join("project");
    let real = root.join("real");
    fs::create_dir_all(&real).expect("real directory");
    symlink(&real, root.join("linked")).expect("watched symlink");

    let result = LocalProjectFilesystem.validate_configuration(
        root.to_str().expect("UTF-8 root"),
        &["linked".to_owned()],
        &[],
    );

    assert!(matches!(
        result,
        Err(ProjectError::WatchedLocationLinkNotAllowed)
    ));
}
