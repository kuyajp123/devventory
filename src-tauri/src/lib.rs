mod app;
mod features;
mod shared;

use tauri::Manager;

use app::state::AppState;
use features::agent_usage::commands::{
    delete_agent_account, delete_agent_quota, list_agent_accounts, preview_agent_reset,
    save_agent_account, save_agent_quota, take_due_agent_reminders,
};
use features::app_health::commands::health_check;
use features::asset_library::commands::{
    get_asset, import_asset, list_asset_variant_candidates, list_asset_variants, list_assets,
    preview_asset_import, resolve_asset_variant_path, run_asset_action, update_asset_metadata,
    update_asset_variants,
};
use features::environment_tracker::commands::{
    add_environment_source, create_environment, delete_environment, delete_environment_source,
    get_environment_matrix, list_environment_source_candidates, list_environment_sources,
    list_environments, refresh_environment, refresh_project_environment_sources,
    reorder_environment_sources, reorder_environments, update_environment,
};
use features::file_inventory::commands::{
    list_project_files, rescan_project, rescan_watched_location,
};
use features::projects::commands::{
    create_project, get_project, list_projects, scan_project_root, validate_project_root,
};
use features::settings::commands::{get_last_opened_project_id, save_last_opened_project_id};
use features::validation_center::commands::{
    delete_validation_rule, export_environment_manifest, get_validation_summary,
    list_validation_issues, list_validation_rules, preview_environment_manifest,
    reorder_validation_rules, run_project_validation, save_validation_rule,
    set_validation_issue_status,
};

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
            list_agent_accounts,
            save_agent_account,
            delete_agent_account,
            save_agent_quota,
            delete_agent_quota,
            preview_agent_reset,
            take_due_agent_reminders,
            validate_project_root,
            scan_project_root,
            create_project,
            list_projects,
            get_project,
            get_last_opened_project_id,
            save_last_opened_project_id,
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
            run_asset_action,
            list_environments,
            create_environment,
            update_environment,
            delete_environment,
            reorder_environments,
            list_environment_sources,
            add_environment_source,
            delete_environment_source,
            reorder_environment_sources,
            list_environment_source_candidates,
            get_environment_matrix,
            refresh_environment,
            refresh_project_environment_sources,
            list_validation_rules,
            save_validation_rule,
            delete_validation_rule,
            reorder_validation_rules,
            list_validation_issues,
            get_validation_summary,
            run_project_validation,
            set_validation_issue_status,
            preview_environment_manifest,
            export_environment_manifest
        ])
        .run(tauri::generate_context!())
        .expect("error while running Devventory");
}
