mod app;
mod features;
mod shared;

use tauri::Manager;

use app::state::AppState;
use features::app_health::commands::health_check;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    shared::telemetry::initialize();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_directory = app.path().app_local_data_dir()?;
            let state = tauri::async_runtime::block_on(AppState::initialize(data_directory))?;
            app.manage(state);

            tracing::info!("Devventory application state initialized");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![health_check])
        .run(tauri::generate_context!())
        .expect("error while running Devventory");
}
