use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tracing::{error, info, warn};

use super::state::MarkdownReaderState;

pub(crate) const MARKDOWN_READER_WINDOW_LABEL: &str = "markdown-reader";
pub(crate) const DOCUMENT_CHANGED_EVENT: &str = "markdown-reader:document-changed";

const READER_TITLE_SUFFIX: &str = "Devventory Reader";
const READER_SIZE: (f64, f64) = (960.0, 720.0);
const READER_MIN_SIZE: (f64, f64) = (640.0, 480.0);

pub(crate) fn window_title(path: &Path) -> String {
    match path.file_name() {
        Some(name) => format!("{} - {READER_TITLE_SUFFIX}", name.to_string_lossy()),
        None => READER_TITLE_SUFFIX.to_string(),
    }
}

/// Records `path` as the current document and presents the reader window.
///
/// Window creation is moved off the calling thread because building a webview
/// from inside a main-thread callback can deadlock on Windows.
pub(crate) fn open_markdown_reader(app: &AppHandle, path: PathBuf) {
    let Some(state) = app.try_state::<MarkdownReaderState>() else {
        warn!("Markdown reader state unavailable; ignoring open request");
        return;
    };
    let title = window_title(&path);
    state.set_current(path);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        present_reader_window(&app, &title);
    });
}

fn present_reader_window(app: &AppHandle, title: &str) {
    if let Some(window) = app.get_webview_window(MARKDOWN_READER_WINDOW_LABEL) {
        refresh_existing_window(app, &window, title);
        return;
    }

    let result = WebviewWindowBuilder::new(
        app,
        MARKDOWN_READER_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title(title)
    .inner_size(READER_SIZE.0, READER_SIZE.1)
    .min_inner_size(READER_MIN_SIZE.0, READER_MIN_SIZE.1)
    .resizable(true)
    .center()
    .focused(true)
    .build();

    match result {
        Ok(_) => info!("Markdown reader window opened"),
        Err(err) => {
            // A concurrent open may have created the window first; reuse it if so.
            if let Some(window) = app.get_webview_window(MARKDOWN_READER_WINDOW_LABEL) {
                refresh_existing_window(app, &window, title);
            } else {
                error!(error = %err, "Failed to create Markdown reader window");
            }
        }
    }
}

fn refresh_existing_window(app: &AppHandle, window: &WebviewWindow, title: &str) {
    let _ = window.set_title(title);
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    let _ = window.show();
    let _ = window.set_focus();
    if let Err(err) = app.emit_to(MARKDOWN_READER_WINDOW_LABEL, DOCUMENT_CHANGED_EVENT, ()) {
        warn!(error = %err, "Failed to notify Markdown reader of a new document");
    }
}
