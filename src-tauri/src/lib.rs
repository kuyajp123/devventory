mod app;
mod features;
mod shared;

use tauri::Manager;

use app::state::AppState;
use features::agent_usage::commands::{
    acknowledge_agent_reminders, delete_agent_account, delete_agent_quota,
    emit_agent_usage_changed, list_agent_accounts, save_agent_account, save_agent_quota,
    test_normal_notification, test_system_channel_directly,
};
use features::app_health::commands::health_check;
use features::asset_library::commands::{
    get_asset, import_asset, list_asset_variant_candidates, list_asset_variants, list_assets,
    preview_asset_import, resolve_asset_variant_path, run_asset_action, update_asset_metadata,
    update_asset_variants,
};
use features::dashboard::commands::get_project_dashboard;
use features::environment_tracker::commands::{
    add_custom_environment_key, add_environment_source, copy_custom_environment_key,
    copy_custom_environment_source, create_custom_environment_source, create_environment,
    delete_custom_environment_key, delete_custom_environment_source, delete_environment,
    delete_environment_source, get_environment_matrix, list_custom_environment_sources,
    list_environment_source_candidates, list_environment_sources, list_environments,
    refresh_environment, refresh_project_environment_sources, rename_custom_environment_source,
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

use app::notification_session::{
    acknowledge_agent_unread_reminders, get_agent_reminder_unread_state,
    open_agent_unread_from_quick_access,
};
use app::quick_access::{
    hide_quick_access_command, open_agent_usage_from_quick_access,
    open_environment_settings_from_quick_access_command,
    open_main_window_from_quick_access_command, set_quick_access_mode_command,
    set_quick_access_prevent_auto_hide_command, show_main_exclusive, show_quick_access_exclusive,
    QuickAccessState, QUICK_ACCESS_WINDOW_LABEL, TRAY_SINGLE_CLICK_DELAY_MS,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    shared::telemetry::initialize();

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let is_autostart = argv.iter().any(|arg| arg == "--autostart");
            if !is_autostart {
                let _ = show_main_exclusive(app);
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
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    app::lifecycle::handle_close_requested(window.app_handle(), window, api);
                }
            } else if window.label() == QUICK_ACCESS_WINDOW_LABEL {
                match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        let state = window.app_handle().try_state::<AppState>();
                        let is_quitting = state
                            .map(|s| s.lifecycle_state().is_quitting())
                            .unwrap_or(false);
                        if !is_quitting {
                            api.prevent_close();
                            app::quick_access::hide_quick_access(window.app_handle());
                        }
                    }
                    tauri::WindowEvent::Moved(pos) => {
                        if let Some(state) = window.app_handle().try_state::<QuickAccessState>() {
                            state.record_moved_position(pos.x, pos.y);
                        }
                    }
                    tauri::WindowEvent::Focused(focused) => {
                        app::quick_access::handle_quick_access_focus_changed(
                            window.app_handle(),
                            *focused,
                        );
                    }
                    _ => {}
                }
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
            app.manage(QuickAccessState::new());

            let quick_panel_builder = tauri::WebviewWindowBuilder::new(
                app,
                QUICK_ACCESS_WINDOW_LABEL,
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Devventory Quick Access")
            .inner_size(360.0, 260.0)
            .decorations(false)
            .always_on_top(true)
            .resizable(false)
            .skip_taskbar(true)
            .visible(false);

            if let Err(err) = quick_panel_builder.build() {
                tracing::error!(error = %err, "Failed to create quick-panel WebviewWindow during setup");
            }

            let open_main_item = tauri::menu::MenuItem::with_id(
                app,
                "open_devventory",
                "Open Devventory",
                true,
                None::<&str>,
            )?;
            let open_quick_item = tauri::menu::MenuItem::with_id(
                app,
                "open_quick_access",
                "Open Quick Access",
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
                &[&open_main_item, &open_quick_item, &separator_item, &quit_item],
            )?;

            let mut tray_builder = tauri::tray::TrayIconBuilder::with_id("main")
                .tooltip("Devventory")
                .menu(&menu)
                .show_menu_on_left_click(false);

            if let Some(icon) = app::notification_session::get_base_tray_icon(app.handle()) {
                tray_builder = tray_builder.icon(icon);
            }

            let tray_result = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_devventory" => {
                        let _ = show_main_exclusive(app);
                    }
                    "open_quick_access" => {
                        show_quick_access_exclusive(app);
                    }
                    "quit_devventory" => app::lifecycle::request_quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state,
                        ..
                    } => {
                        if button_state != tauri::tray::MouseButtonState::Up {
                            return;
                        }

                        let app_handle = tray.app_handle().clone();
                        let state = app_handle.try_state::<QuickAccessState>();
                        if let Some(state) = state {
                            if state.should_suppress_tray_single_click() {
                                state.invalidate_click_generation();
                                return;
                            }

                            let gen = state.next_click_generation();
                            let app_clone = app_handle.clone();
                            let handle = tauri::async_runtime::spawn(async move {
                                tokio::time::sleep(std::time::Duration::from_millis(
                                    TRAY_SINGLE_CLICK_DELAY_MS,
                                ))
                                .await;
                                if let Some(st) = app_clone.try_state::<QuickAccessState>() {
                                    if st.current_click_generation() == gen {
                                        show_quick_access_exclusive(&app_clone);
                                    }
                                }
                            });
                            state.set_pending_click(handle);
                        } else {
                            show_quick_access_exclusive(&app_handle);
                        }
                    }
                    tauri::tray::TrayIconEvent::DoubleClick {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } => {
                        let app_handle = tray.app_handle();
                        if let Some(state) = app_handle.try_state::<QuickAccessState>() {
                            state.record_tray_double_click();
                            state.invalidate_click_generation();
                            state.cancel_pending_click();
                        }
                        let _ = show_main_exclusive(app_handle);
                    }
                    _ => {}
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
                let _ = app::lifecycle::activate_main_window(&app_handle);
            } else if !is_tray_available {
                tracing::warn!("Autostart launch without usable tray icon; falling back to showing main window");
                let _ = app::lifecycle::activate_main_window(&app_handle);
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
            emit_agent_usage_changed,
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
            list_custom_environment_sources,
            create_custom_environment_source,
            rename_custom_environment_source,
            delete_custom_environment_source,
            add_custom_environment_key,
            delete_custom_environment_key,
            copy_custom_environment_key,
            copy_custom_environment_source,
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
            export_environment_manifest,
            hide_quick_access_command,
            open_agent_usage_from_quick_access,
            open_environment_settings_from_quick_access_command,
            open_main_window_from_quick_access_command,
            set_quick_access_prevent_auto_hide_command,
            set_quick_access_mode_command,
            get_agent_reminder_unread_state,
            acknowledge_agent_unread_reminders,
            open_agent_unread_from_quick_access
        ])
        .run(tauri::generate_context!())
        .expect("error while running Devventory");
}
