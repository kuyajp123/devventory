mod app;
mod features;
mod shared;

use tauri::Manager;

use app::state::AppState;
use features::agent_usage::commands::{
    acknowledge_agent_reminders, delete_agent_account, delete_agent_quota, list_agent_accounts,
    save_agent_account, save_agent_quota, test_normal_notification, test_system_channel_directly,
};
use features::app_health::commands::health_check;
use features::asset_library::commands::{
    get_asset, import_asset, list_asset_variant_candidates, list_asset_variants, list_assets,
    preview_asset_import, resolve_asset_variant_path, run_asset_action, update_asset_metadata,
    update_asset_variants,
};
use features::dashboard::commands::get_project_dashboard;
use features::environment_tracker::commands::{
    add_environment_source, create_environment, delete_environment, delete_environment_source,
    get_environment_matrix, list_environment_source_candidates, list_environment_sources,
    list_environments, refresh_environment, refresh_project_environment_sources,
    reorder_environment_sources, reorder_environments, update_environment,
};
use features::file_inventory::commands::{
    list_project_directory, list_project_files, rescan_project, rescan_watched_location,
};
use features::projects::commands::{
    create_project, delete_project, get_project, list_projects, scan_project_root,
    validate_project_root, validate_project_subdirectory,
};
use features::search::commands::{
    clear_search_history, delete_search_history, list_search_history, record_search_history,
    search_metadata,
};
use features::settings::commands::{
    get_background_startup_preferences, get_last_opened_project_id, get_notification_preferences,
    save_background_startup_preferences, save_last_opened_project_id,
    save_notification_preferences,
};
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
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let is_autostart = argv.iter().any(|arg| arg == "--autostart");
            if !is_autostart {
                app::lifecycle::activate_main_window(app);
            } else {
                tracing::info!("Secondary autostart launch ignored while instance running");
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::AppleScript,
            Some(vec!["--autostart"]),
        ))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                app::lifecycle::handle_close_requested(window.app_handle(), window, api);
            }
        })
        .setup(|app| {
            let is_autostart_launch = std::env::args().any(|arg| arg == "--autostart");
            let data_directory = app.path().app_local_data_dir()?;
            let state = tauri::async_runtime::block_on(AppState::initialize(
                data_directory,
                is_autostart_launch,
            ))?;
            app.manage(state);

            let open_item = tauri::menu::MenuItem::with_id(
                app,
                "open_devventory",
                "Open Devventory",
                true,
                None::<&str>,
            )?;
            let separator_item = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = tauri::menu::MenuItem::with_id(
                app,
                "quit_devventory",
                "Quit Devventory",
                true,
                None::<&str>,
            )?;
            let menu = tauri::menu::Menu::with_items(
                app,
                &[&open_item, &separator_item, &quit_item],
            )?;

            let tray_result = tauri::tray::TrayIconBuilder::with_id("main")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_devventory" => app::lifecycle::activate_main_window(app),
                    "quit_devventory" => app::lifecycle::request_quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        app::lifecycle::activate_main_window(tray.app_handle());
                    }
                })
                .build(app);

            let is_tray_available = tray_result.is_ok();
            if let Err(ref err) = tray_result {
                tracing::error!(error = %err, "Failed to create system tray icon");
            }

            let app_state = app.state::<AppState>();
            app_state.lifecycle_state().set_tray_available(is_tray_available);

            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(
                app_state.start_inventory_runtime(app_handle.clone()),
            )?;
            app_state.start_agent_reminder_runtime(app_handle.clone());

            if !is_autostart_launch {
                app::lifecycle::activate_main_window(&app_handle);
            } else if !is_tray_available {
                tracing::warn!("Autostart launch without usable tray icon; falling back to showing main window");
                app::lifecycle::activate_main_window(&app_handle);
            } else {
                tracing::info!("Devventory started silently in background via autostart");
            }

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
            acknowledge_agent_reminders,
            test_normal_notification,
            test_system_channel_directly,
            validate_project_root,
            validate_project_subdirectory,
            scan_project_root,
            create_project,
            delete_project,
            list_projects,
            get_project,
            search_metadata,
            record_search_history,
            list_search_history,
            delete_search_history,
            clear_search_history,
            get_project_dashboard,
            get_last_opened_project_id,
            save_last_opened_project_id,
            get_notification_preferences,
            save_notification_preferences,
            get_background_startup_preferences,
            save_background_startup_preferences,
            list_project_directory,
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
