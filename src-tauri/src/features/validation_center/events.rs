use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub(crate) const VALIDATION_CHANGED_EVENT: &str = "validation://changed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidationChangedPayload {
    project_id: String,
}

pub(crate) fn emit_validation_changed(app: &AppHandle, project_id: Uuid) {
    if let Err(error) = app.emit(
        VALIDATION_CHANGED_EVENT,
        ValidationChangedPayload {
            project_id: project_id.to_string(),
        },
    ) {
        tracing::warn!(
            project_id = %project_id,
            error = %error,
            "could not notify the frontend about validation changes"
        );
    }
}
