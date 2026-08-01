use sqlx::Error as SqlxError;

use super::command::CommandError;
use super::AppError;

#[test]
fn serializes_safe_command_errors_without_internal_backend_details() {
    let command_error = CommandError::from(AppError::Database(SqlxError::Protocol(
        "sensitive database detail".to_string(),
    )));

    let serialized =
        serde_json::to_string(&command_error).expect("command error should be serializable");

    assert!(serialized.contains("STORAGE_UNAVAILABLE"));
    assert!(serialized.contains("Local application data is unavailable"));
    assert!(!serialized.contains("sensitive database detail"));
    assert!(!serialized.contains("Protocol"));
}
