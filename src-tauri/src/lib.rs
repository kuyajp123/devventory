mod app;
mod features;
mod shared;

use tauri::Manager;

use app::state::AppState;
use features::app_health::commands::health_check;
use features::asset_library::commands::{
    get_asset, import_asset, list_asset_variant_candidates, list_asset_variants, list_assets,
    preview_asset_import, resolve_asset_variant_path, run_asset_action, update_asset_metadata,
    update_asset_variants,
};
use features::environment_tracker::commands::{
    add_environment_source, create_environment, delete_environment, get_environment_matrix,
    list_environment_source_candidates, list_environments, refresh_all_environments,
    refresh_environment, refresh_environment_source, remove_environment_source,
    reorder_environment_sources, reorder_environments, update_environment,
};
use features::file_inventory::commands::{
    list_project_files, rescan_project, rescan_watched_location,
};
use features::projects::commands::{
    create_project, get_project, list_projects, scan_project_root, validate_project_root,
};
use features::settings::commands::{get_last_opened_project_id, save_last_opened_project_id};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    shared::telemetry::initialize();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_directory = app.path().app_local_data_dir()?;
            let state = tauri::async_runtime::block_on(AppState::initialize(data_directory))?;
            app.manage(state);
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(
                app.state::<AppState>().start_inventory_runtime(app_handle),
            )?;

            tracing::info!("Devventory application state initialized");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            health_check,
            validate_project_root,
            scan_project_root,
            create_project,
            list_projects,
            get_project,
            get_last_opened_project_id,
            save_last_opened_project_id,
            list_environments,
            create_environment,
            update_environment,
            delete_environment,
            reorder_environments,
            list_environment_source_candidates,
            add_environment_source,
            remove_environment_source,
            reorder_environment_sources,
            refresh_environment_source,
            refresh_environment,
            refresh_all_environments,
            get_environment_matrix,
            list_project_files,
            rescan_project,
            rescan_watched_location,
            list_assets,
            get_asset,
            preview_asset_import,
            import_asset,
            update_asset_metadata,
            list_asset_variant_candidates,
            list_asset_variants,
            resolve_asset_variant_path,
            update_asset_variants,
            run_asset_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running Devventory");
}
