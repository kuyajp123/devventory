use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use std::time::UNIX_EPOCH;

use super::error::MarkdownReaderError;
use super::launch::has_markdown_extension;

/// Matches the file-inventory preview ceiling; the shared viewer refuses larger files anyway.
pub(crate) const MAX_DOCUMENT_SIZE_BYTES: u64 = 2 * 1024 * 1024;

const UTF8_BOM: char = '\u{feff}';

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MarkdownDocument {
    pub(crate) file_name: String,
    pub(crate) path: String,
    pub(crate) content: String,
    pub(crate) size_bytes: u64,
    pub(crate) modified_at_ms: Option<i64>,
}

/// Reads a user-opened Markdown document with bounded memory use.
///
/// The extension is checked on both the requested and the canonical path so a
/// `.md` link cannot be used to read a non-Markdown target.
pub(crate) fn read_markdown_document(path: &Path) -> Result<MarkdownDocument, MarkdownReaderError> {
    if !has_markdown_extension(path) {
        return Err(MarkdownReaderError::UnsupportedFile);
    }

    let canonical_path = fs::canonicalize(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            MarkdownReaderError::NotFound
        } else {
            MarkdownReaderError::Unreadable
        }
    })?;
    if !has_markdown_extension(&canonical_path) {
        return Err(MarkdownReaderError::UnsupportedFile);
    }

    let metadata = fs::metadata(&canonical_path).map_err(|_| MarkdownReaderError::Unreadable)?;
    if !metadata.is_file() {
        return Err(MarkdownReaderError::UnsupportedFile);
    }
    if metadata.len() > MAX_DOCUMENT_SIZE_BYTES {
        return Err(MarkdownReaderError::TooLarge);
    }

    // Bound the read as well, in case the file grows between the metadata check and the read.
    let mut bytes = Vec::with_capacity(usize::try_from(metadata.len()).unwrap_or_default());
    File::open(&canonical_path)
        .and_then(|file| {
            file.take(MAX_DOCUMENT_SIZE_BYTES + 1)
                .read_to_end(&mut bytes)
        })
        .map_err(|_| MarkdownReaderError::Unreadable)?;
    let size_bytes = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
    if size_bytes > MAX_DOCUMENT_SIZE_BYTES {
        return Err(MarkdownReaderError::TooLarge);
    }

    let mut content = String::from_utf8(bytes).map_err(|_| MarkdownReaderError::NotText)?;
    if content.starts_with(UTF8_BOM) {
        content.remove(0);
    }

    let file_name = canonical_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let modified_at_ms = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| i64::try_from(duration.as_millis()).ok());

    Ok(MarkdownDocument {
        file_name,
        path: display_path(&canonical_path),
        content,
        size_bytes,
        modified_at_ms,
    })
}

/// Removes the Windows verbatim prefix that `canonicalize` adds (`\\?\C:\...`).
pub(crate) fn display_path(path: &Path) -> String {
    let raw = path.to_string_lossy();
    if let Some(rest) = raw.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = raw.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        raw.into_owned()
    }
}
