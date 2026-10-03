use std::path::PathBuf;
use std::sync::Mutex;

/// Holds the document most recently opened from the OS (Explorer "Open with" or CLI).
///
/// The reader webview never supplies a path: it can only read the file the user
/// explicitly opened, which keeps arbitrary filesystem reads off the IPC surface.
#[derive(Debug, Default)]
pub(crate) struct MarkdownReaderState {
    current: Mutex<Option<PathBuf>>,
}

impl MarkdownReaderState {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn set_current(&self, path: PathBuf) {
        let mut guard = self
            .current
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *guard = Some(path);
    }

    pub(crate) fn current(&self) -> Option<PathBuf> {
        let guard = self
            .current
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        guard.clone()
    }
}
