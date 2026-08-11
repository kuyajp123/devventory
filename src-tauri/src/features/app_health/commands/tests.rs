use tempfile::TempDir;

use super::health_check_app;
use crate::app::state::AppState;

#[tokio::test]
async fn reports_the_existing_frontend_health_message_when_storage_is_ready() {
    let temp = TempDir::new().expect("temporary directory should be created");
    let state = AppState::initialize(temp.path(), false)
        .await
        .expect("application state should initialize");

    let message = health_check_app(&state)
        .await
        .expect("health check should pass");

    assert_eq!(message, "Devventory Rust backend is running");

    state.close().await;
}
