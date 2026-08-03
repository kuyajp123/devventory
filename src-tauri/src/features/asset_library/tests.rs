use std::fs;
use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use tempfile::{tempdir, TempDir};
use uuid::Uuid;

use crate::features::file_inventory::{
    FileInventoryService, ScanType, SqliteFileInventoryRepository,
};
use crate::features::projects::{
    CreateProject, LocalProjectFilesystem, ProjectService, ProjectType, SqliteProjectRepository,
};
use crate::shared::database::{initialize_database, DatabasePaths};
use crate::shared::errors::command::CommandError;

use super::error::AssetError;
use super::filesystem::LocalAssetFilesystem;
use super::model::{
    AssetMetadataUpdate, AssetOrigin, AssetQuery, AssetSortField, AssetVariantsUpdate,
    CollisionChoice, ImportAsset, ImportStatus, SortDirection, VariantCandidateQuery,
    VariantCandidateScope, VariantPathInput,
};
use super::repository::SqliteAssetRepository;
use super::service::AssetService;

struct TestContext {
    _workspace: TempDir,
    root: PathBuf,
    external: PathBuf,
    pool: SqlitePool,
    project_id: Uuid,
    project_service: ProjectService,
    service: AssetService,
}

impl TestContext {
    async fn new() -> Self {
        let workspace = tempdir().expect("temporary workspace");
        let root = workspace.path().join("project");
        let requested_root = root.join(".");
        let external = workspace.path().join("external");
        fs::create_dir_all(root.join("assets")).expect("asset directory");
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
                name: "Asset project".to_owned(),
                description: None,
                project_type: ProjectType::Desktop,
                root_path: requested_root.to_string_lossy().into_owned(),
                watched_locations: vec![".".to_owned()],
                exclusions: vec![],
            })
            .await
            .expect("project creation");
        let project_id = project_service
            .scan_targets()
            .await
            .expect("persisted project scan targets")
            .into_iter()
            .next()
            .expect("persisted project")
            .id;
        let service = AssetService::new(
            SqliteAssetRepository::new(pool.clone()),
            project_service.clone(),
            LocalAssetFilesystem,
        );
        Self {
            _workspace: workspace,
            root,
            external,
            pool,
            project_id,
            project_service,
            service,
        }
    }

    fn external_file(&self, name: &str, content: impl AsRef<[u8]>) -> PathBuf {
        let path = self.external.join(name);
        fs::write(&path, content).expect("external source file");
        path
    }

    fn import_input(&self, source: &Path, collision: CollisionChoice) -> ImportAsset {
        ImportAsset {
            project_id: self.project_id,
            source_path: source.to_string_lossy().into_owned(),
            destination: "assets".to_owned(),
            filename: None,
            collision,
            tags: vec![],
            note: None,
            favorite: false,
        }
    }
}

#[tokio::test]
async fn imports_a_file_streamingly_and_persists_managed_metadata() {
    let context = TestContext::new().await;
    let source = context.external_file("brand.png", vec![7_u8; 2 * 1024 * 1024]);
    let mut input = context.import_input(&source, CollisionChoice::Cancel);
    input.tags = vec![
        "Brand".to_owned(),
        "brand".to_owned(),
        "Approved".to_owned(),
    ];
    input.note = Some("Primary launch artwork".to_owned());
    input.favorite = true;

    let result = context.service.import(input).await.expect("asset import");
    let asset = result.asset.expect("imported asset");
    assert_eq!(result.status, ImportStatus::Imported);
    assert_eq!(asset.relative_path, "assets/brand.png");
    assert_eq!(asset.origin, AssetOrigin::Managed);
    assert_eq!(asset.tags, ["Approved", "Brand"]);
    assert_eq!(asset.note.as_deref(), Some("Primary launch artwork"));
    assert!(asset.favorite);
    assert_eq!(
        fs::metadata(context.root.join(&asset.relative_path))
            .unwrap()
            .len(),
        2 * 1024 * 1024
    );

    let page = context
        .service
        .query(query(
            context.project_id,
            Some("brand"),
            Some("brand"),
            Some(true),
            Some(AssetOrigin::Managed),
            1,
            1,
        ))
        .await
        .expect("bounded asset query");
    assert_eq!(page.total_items, 1);
    assert_eq!(page.items[0].id, asset.id);
}

#[tokio::test]
async fn collision_choices_cancel_replace_keep_both_and_rename_are_predictable() {
    let context = TestContext::new().await;
    fs::write(context.root.join("assets/logo.txt"), "existing").expect("existing destination");
    let source = context.external_file("logo.txt", "replacement");

    let cancelled = context
        .service
        .import(context.import_input(&source, CollisionChoice::Cancel))
        .await
        .expect("cancel collision");
    assert_eq!(cancelled.status, ImportStatus::Cancelled);
    assert_eq!(
        fs::read_to_string(context.root.join("assets/logo.txt")).unwrap(),
        "existing"
    );

    let kept = context
        .service
        .import(context.import_input(&source, CollisionChoice::KeepBoth))
        .await
        .expect("keep both collision")
        .asset
        .unwrap();
    assert_eq!(kept.relative_path, "assets/logo (1).txt");

    let replaced = context
        .service
        .import(context.import_input(&source, CollisionChoice::Replace))
        .await
        .expect("replace collision")
        .asset
        .unwrap();
    assert_eq!(replaced.relative_path, "assets/logo.txt");
    assert_eq!(
        fs::read_to_string(context.root.join("assets/logo.txt")).unwrap(),
        "replacement"
    );

    let mut renamed = context.import_input(&source, CollisionChoice::Rename);
    renamed.filename = Some("logo-final.txt".to_owned());
    assert_eq!(
        context
            .service
            .import(renamed)
            .await
            .unwrap()
            .asset
            .unwrap()
            .relative_path,
        "assets/logo-final.txt"
    );
}

#[tokio::test]
async fn rejects_traversal_absolute_destinations_and_invalid_names_before_copying() {
    let context = TestContext::new().await;
    let source = context.external_file("safe.txt", "safe");
    let destinations = vec![
        "../outside".to_owned(),
        context.external.to_string_lossy().into_owned(),
    ];
    for destination in destinations {
        let mut input = context.import_input(&source, CollisionChoice::Cancel);
        input.destination = destination;
        assert!(matches!(
            context.service.import(input).await,
            Err(AssetError::DestinationOutsideRoot)
        ));
    }
    for filename in ["../escape.txt", "CON", "bad|name.txt", ""] {
        let mut input = context.import_input(&source, CollisionChoice::Rename);
        input.filename = Some(filename.to_owned());
        assert!(matches!(
            context.service.import(input).await,
            Err(AssetError::InvalidFilename)
        ));
    }
    assert!(!context.external.join("escape.txt").exists());

    let mut directory_source = context.import_input(&source, CollisionChoice::Cancel);
    directory_source.source_path = context.external.to_string_lossy().into_owned();
    assert!(matches!(
        context.service.import(directory_source).await,
        Err(AssetError::SourceInvalid)
    ));
}

#[cfg(unix)]
#[tokio::test]
async fn rejects_symbolic_link_destination_escapes() {
    use std::os::unix::fs::symlink;
    let context = TestContext::new().await;
    symlink(&context.external, context.root.join("linked")).expect("destination symlink");
    let source = context.external_file("safe.txt", "safe");
    let mut input = context.import_input(&source, CollisionChoice::Cancel);
    input.destination = "linked".to_owned();
    assert!(matches!(
        context.service.import(input).await,
        Err(AssetError::DestinationLinkNotAllowed)
    ));
}

#[tokio::test]
async fn detects_identical_content_but_not_same_name_with_different_content() {
    let context = TestContext::new().await;
    let original = context.external_file("first.bin", b"identical-content");
    let first = context
        .service
        .import(context.import_input(&original, CollisionChoice::Cancel))
        .await
        .expect("first import")
        .asset
        .unwrap();
    let identical = context.external_file("copy.bin", b"identical-content");
    let duplicate = context
        .service
        .preview(context.project_id, identical.to_string_lossy().into_owned())
        .await
        .expect("duplicate preview")
        .duplicate
        .expect("content duplicate");
    assert_eq!(duplicate.asset_id, first.id);

    let different = context.external_file("first.bin", b"different-content");
    assert!(context
        .service
        .preview(context.project_id, different.to_string_lossy().into_owned())
        .await
        .expect("different preview")
        .duplicate
        .is_none());
}

#[tokio::test]
async fn metadata_updates_prevent_duplicate_tags_and_invalid_variant_relationships() {
    let context = TestContext::new().await;
    let first_source = context.external_file("one.svg", "one");
    let second_source = context.external_file("two.svg", "two");
    let first = context
        .service
        .import(context.import_input(&first_source, CollisionChoice::Cancel))
        .await
        .unwrap()
        .asset
        .unwrap();
    let second = context
        .service
        .import(context.import_input(&second_source, CollisionChoice::Cancel))
        .await
        .unwrap()
        .asset
        .unwrap();
    let updated = context
        .service
        .update_metadata(AssetMetadataUpdate {
            project_id: context.project_id,
            asset_id: first.id,
            tags: vec!["Icon".to_owned(), "icon".to_owned()],
            note: Some("Dark variant".to_owned()),
            favorite: true,
            variant_ids: vec![second.id],
        })
        .await
        .expect("metadata update");
    assert_eq!(updated.tags, ["Icon"]);
    assert_eq!(updated.note.as_deref(), Some("Dark variant"));
    assert!(updated.favorite);
    assert_eq!(updated.variant_ids, [second.id]);

    let reverse = context
        .service
        .update_metadata(AssetMetadataUpdate {
            project_id: context.project_id,
            asset_id: second.id,
            tags: vec![],
            note: None,
            favorite: false,
            variant_ids: vec![first.id],
        })
        .await
        .expect("reverse variant update");
    assert_eq!(reverse.variant_ids, [first.id]);
    let relation_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM asset_relations WHERE project_id = ?")
            .bind(context.project_id.to_string())
            .fetch_one(&context.pool)
            .await
            .unwrap();
    assert_eq!(relation_count, 1);

    assert!(matches!(
        context
            .service
            .update_metadata(AssetMetadataUpdate {
                project_id: context.project_id,
                asset_id: first.id,
                tags: vec![],
                note: None,
                favorite: false,
                variant_ids: vec![first.id],
            })
            .await,
        Err(AssetError::VariantSelfReference)
    ));
}

#[tokio::test]
async fn repeated_import_and_watcher_reconciliation_keep_one_index_record() {
    let context = TestContext::new().await;
    let source = context.external_file("stable.txt", "stable");
    let first = context
        .service
        .import(context.import_input(&source, CollisionChoice::Cancel))
        .await
        .unwrap()
        .asset
        .unwrap();
    let second = context
        .service
        .import(context.import_input(&source, CollisionChoice::Replace))
        .await
        .unwrap()
        .asset
        .unwrap();
    assert_eq!(first.id, second.id);

    let inventory = FileInventoryService::new(
        SqliteFileInventoryRepository::new(context.pool.clone()),
        context.project_service.clone(),
    );
    inventory
        .reconcile_project(context.project_id, ScanType::Watcher)
        .await
        .unwrap();
    let after_watcher = context
        .service
        .get(context.project_id, first.id)
        .await
        .unwrap();
    assert_eq!(after_watcher.origin, AssetOrigin::Managed);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM indexed_files WHERE project_id = ? AND relative_path = 'assets/stable.txt'")
        .bind(context.project_id.to_string())
        .fetch_one(&context.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn concurrent_import_and_reconciliation_cannot_create_duplicate_records() {
    let context = TestContext::new().await;
    let source = context.external_file("race.txt", "race");
    let inventory = FileInventoryService::new(
        SqliteFileInventoryRepository::new(context.pool.clone()),
        context.project_service.clone(),
    );
    let import_service = context.service.clone();
    let input = context.import_input(&source, CollisionChoice::Cancel);
    let project_id = context.project_id;

    let (import_result, scan_result) = tokio::join!(
        import_service.import(input),
        inventory.reconcile_project(project_id, ScanType::Watcher)
    );
    import_result.expect("concurrent managed import");
    scan_result.expect("concurrent reconciliation");

    let (count, managed): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), MAX(managed) FROM indexed_files
         WHERE project_id = ? AND relative_path = 'assets/race.txt'",
    )
    .bind(project_id.to_string())
    .fetch_one(&context.pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
    assert_eq!(managed, 1);
}

#[tokio::test]
async fn database_failure_after_copy_restores_the_filesystem_and_leaves_no_record() {
    let context = TestContext::new().await;
    let source = context.external_file("rollback.txt", "rollback");
    context.service.fail_next_persist();
    assert!(context
        .service
        .import(context.import_input(&source, CollisionChoice::Cancel))
        .await
        .is_err());
    assert!(!context.root.join("assets/rollback.txt").exists());
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM indexed_files WHERE project_id = ? AND relative_path = 'assets/rollback.txt'")
        .bind(context.project_id.to_string())
        .fetch_one(&context.pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn missing_files_return_typed_quick_action_errors_without_opening_applications() {
    let context = TestContext::new().await;
    let source = context.external_file("gone.txt", "gone");
    let asset = context
        .service
        .import(context.import_input(&source, CollisionChoice::Cancel))
        .await
        .unwrap()
        .asset
        .unwrap();
    fs::remove_file(context.root.join(&asset.relative_path)).unwrap();
    assert!(matches!(
        context
            .service
            .action_target(context.project_id, asset.id)
            .await,
        Err(AssetError::NotFound)
    ));
}

#[tokio::test]
async fn variant_suggestions_rank_same_folder_then_filename_and_hide_unrelated_files() {
    let context = TestContext::new().await;
    let current = context
        .index_file("assets/branding/logo.png", "image", false, "active")
        .await;
    let same_folder = context
        .index_file("assets/branding/logo-dark.png", "image", false, "active")
        .await;
    let similar_name = context
        .index_file("assets/mobile/logo-small.png", "image", false, "active")
        .await;
    let compatible_type = context
        .index_file("assets/other/banner.png", "image", false, "active")
        .await;
    let matching_metadata = context
        .index_file("assets/other/readme.pdf", "document", false, "active")
        .await;
    for asset_id in [current, matching_metadata] {
        context
            .service
            .update_metadata(AssetMetadataUpdate {
                project_id: context.project_id,
                asset_id,
                tags: vec!["brand".to_owned()],
                note: None,
                favorite: false,
                variant_ids: vec![],
            })
            .await
            .expect("ranking metadata");
    }
    context
        .index_file("assets/branding/theme.ts", "source", false, "active")
        .await;
    context
        .index_file(
            "assets/branding/vite.config.ts",
            "configuration",
            false,
            "active",
        )
        .await;
    context
        .index_file("assets/branding/missing.png", "image", false, "missing")
        .await;

    let page = context
        .service
        .variant_candidates(VariantCandidateQuery {
            project_id: context.project_id,
            asset_id: current,
            scope: VariantCandidateScope::Suggested,
            search: None,
            excluded_ids: vec![],
            page: 1,
            page_size: 25,
        })
        .await
        .expect("suggested variants");

    assert_eq!(page.asset_root, "assets");
    assert_eq!(page.current_folder, "assets/branding");
    assert_eq!(
        page.items.iter().map(|item| item.id).collect::<Vec<_>>(),
        [
            same_folder,
            similar_name,
            compatible_type,
            matching_metadata
        ]
    );
    assert!(page.items[0].reasons.same_folder);
    assert!(page.items[1].reasons.similar_name);
    assert!(page.items[2].reasons.compatible_type);
    assert!(page.items[3].reasons.matching_metadata);

    let same_folder_page = context
        .service
        .variant_candidates(VariantCandidateQuery {
            project_id: context.project_id,
            asset_id: current,
            scope: VariantCandidateScope::SameFolder,
            search: None,
            excluded_ids: vec![],
            page: 1,
            page_size: 25,
        })
        .await
        .expect("same-folder variants");
    assert!(same_folder_page
        .items
        .iter()
        .all(|item| item.relative_path.starts_with("assets/branding/") && item.status == "active"));
}

#[tokio::test]
async fn variant_scopes_search_paths_and_paginate_thousands_without_loading_them_all() {
    let context = TestContext::new().await;
    let current = context
        .index_file("assets/icons/logo.svg", "image", true, "active")
        .await;
    for index in 0..1_205_u32 {
        context
            .index_file(
                &format!("assets/icons/generated/icon-{index:04}.svg"),
                "image",
                index % 2 == 0,
                "active",
            )
            .await;
    }
    context
        .index_file("src/icon-helper.ts", "source", false, "active")
        .await;

    let page = context
        .service
        .variant_candidates(VariantCandidateQuery {
            project_id: context.project_id,
            asset_id: current,
            scope: VariantCandidateScope::AssetRoot,
            search: Some("generated/icon-1".to_owned()),
            excluded_ids: vec![],
            page: 2,
            page_size: 25,
        })
        .await
        .expect("paginated variants");

    assert_eq!(page.page, 2);
    assert_eq!(page.page_size, 25);
    assert_eq!(page.items.len(), 25);
    assert_eq!(page.total_items, 205);
    assert_eq!(page.total_pages, 9);
    assert!(page.has_more);
    assert!(page
        .items
        .iter()
        .all(|item| item.relative_path.contains("generated/icon-1")));

    let managed = context
        .service
        .variant_candidates(VariantCandidateQuery {
            project_id: context.project_id,
            asset_id: current,
            scope: VariantCandidateScope::Managed,
            search: Some("icon-000".to_owned()),
            excluded_ids: vec![],
            page: 1,
            page_size: 25,
        })
        .await
        .expect("managed variants");
    assert!(managed
        .items
        .iter()
        .all(|item| item.origin == AssetOrigin::Managed));
}

#[tokio::test]
async fn manual_variant_paths_reject_traversal_self_duplicates_missing_and_cycles() {
    let context = TestContext::new().await;
    let first = context
        .index_file("assets/a.png", "image", false, "active")
        .await;
    let second = context
        .index_file("assets/b.png", "image", false, "active")
        .await;
    let third = context
        .index_file("assets/c.png", "image", false, "active")
        .await;
    context
        .index_file("assets/gone.png", "image", false, "missing")
        .await;
    context
        .service
        .update_variants(AssetVariantsUpdate {
            project_id: context.project_id,
            asset_id: second,
            variant_ids: vec![third],
        })
        .await
        .expect("seed relation");

    for (path, expected) in [
        ("../outside.png", "outside"),
        ("assets/a.png", "itself"),
        ("assets/missing.png", "indexed"),
        ("assets/gone.png", "missing"),
    ] {
        let error = context
            .service
            .resolve_variant_path(VariantPathInput {
                project_id: context.project_id,
                asset_id: first,
                relative_path: path.to_owned(),
                selected_variant_ids: vec![],
            })
            .await
            .expect_err("invalid manual path");
        assert!(error.to_string().contains(expected));
    }

    let resolved = context
        .service
        .resolve_variant_path(VariantPathInput {
            project_id: context.project_id,
            asset_id: first,
            relative_path: "assets/b.png".to_owned(),
            selected_variant_ids: vec![],
        })
        .await
        .expect("valid manual path");
    assert_eq!(resolved.id, second);

    let duplicate = context
        .service
        .resolve_variant_path(VariantPathInput {
            project_id: context.project_id,
            asset_id: first,
            relative_path: "assets/b.png".to_owned(),
            selected_variant_ids: vec![second],
        })
        .await
        .expect_err("duplicate selected relation");
    assert!(duplicate.to_string().contains("already selected"));

    let circular = context
        .service
        .resolve_variant_path(VariantPathInput {
            project_id: context.project_id,
            asset_id: first,
            relative_path: "assets/c.png".to_owned(),
            selected_variant_ids: vec![second],
        })
        .await
        .expect_err("circular relation");
    assert!(circular.to_string().contains("circular"));
}

#[tokio::test]
async fn variant_updates_save_and_remove_relationships_without_changing_metadata() {
    let context = TestContext::new().await;
    let first = context
        .index_file("assets/one.svg", "image", true, "active")
        .await;
    let second = context
        .index_file("assets/two.svg", "image", false, "active")
        .await;

    let saved = context
        .service
        .update_variants(AssetVariantsUpdate {
            project_id: context.project_id,
            asset_id: first,
            variant_ids: vec![second],
        })
        .await
        .expect("save variants");
    assert_eq!(saved.variant_ids, [second]);

    let removed = context
        .service
        .update_variants(AssetVariantsUpdate {
            project_id: context.project_id,
            asset_id: first,
            variant_ids: vec![],
        })
        .await
        .expect("remove variants");
    assert!(removed.variant_ids.is_empty());
    assert!(removed.favorite);
}

#[test]
fn command_errors_do_not_serialize_sensitive_source_paths() {
    let error = CommandError::from(AssetError::Filesystem(std::io::Error::other(
        "failed to read C:\\Users\\private\\.env",
    )));
    let serialized = serde_json::to_string(&error).expect("serializable command error");
    assert!(serialized.contains("FILESYSTEM_UNAVAILABLE"));
    assert!(!serialized.contains("private"));
    assert!(!serialized.contains(".env"));
}

fn query(
    project_id: Uuid,
    search: Option<&str>,
    tag: Option<&str>,
    favorite: Option<bool>,
    origin: Option<AssetOrigin>,
    page: u32,
    page_size: u32,
) -> AssetQuery {
    AssetQuery {
        project_id,
        search: search.map(ToOwned::to_owned),
        category: None,
        extension: None,
        tag: tag.map(ToOwned::to_owned),
        favorite,
        origin,
        sort_by: AssetSortField::RelativePath,
        sort_direction: SortDirection::Ascending,
        page,
        page_size,
    }
}

impl TestContext {
    async fn index_file(
        &self,
        relative_path: &str,
        category: &str,
        managed: bool,
        status: &str,
    ) -> Uuid {
        if status == "active" {
            let absolute = self
                .root
                .join(relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
            fs::create_dir_all(absolute.parent().expect("indexed file parent"))
                .expect("indexed file directory");
            fs::write(&absolute, relative_path).expect("indexed file contents");
        }
        let watched_location_id: String = sqlx::query_scalar(
            "SELECT id FROM watched_locations WHERE project_id = ? ORDER BY relative_path LIMIT 1",
        )
        .bind(self.project_id.to_string())
        .fetch_one(&self.pool)
        .await
        .expect("watched location id");
        let scan_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO scan_runs (id, project_id, watched_location_id, scan_type, status, completed_at)
             VALUES (?, ?, ?, 'manual_project', 'completed', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
        )
        .bind(scan_id.to_string())
        .bind(self.project_id.to_string())
        .bind(&watched_location_id)
        .execute(&self.pool)
        .await
        .expect("scan run");
        let id = Uuid::new_v4();
        let name = relative_path.rsplit('/').next().expect("file name");
        let extension = name.rsplit_once('.').map(|(_, extension)| extension);
        sqlx::query(
            "INSERT INTO indexed_files (
                id, project_id, watched_location_id, relative_path, name, extension,
                mime_type, size_bytes, category, source_type, status, last_scan_id, managed,
                is_favorite
             ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, 'discovered', ?, ?, ?, ?)",
        )
        .bind(id.to_string())
        .bind(self.project_id.to_string())
        .bind(watched_location_id)
        .bind(relative_path)
        .bind(name)
        .bind(extension)
        .bind(category)
        .bind(status)
        .bind(scan_id.to_string())
        .bind(managed)
        .bind(managed)
        .execute(&self.pool)
        .await
        .expect("indexed file");
        id
    }
}
