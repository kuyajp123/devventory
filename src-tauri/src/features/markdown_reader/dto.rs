use serde::Serialize;

use super::document::MarkdownDocument;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownDocumentDto {
    pub(crate) file_name: String,
    pub(crate) path: String,
    pub(crate) content: String,
    pub(crate) size_bytes: u64,
    pub(crate) modified_at_ms: Option<i64>,
}

impl From<MarkdownDocument> for MarkdownDocumentDto {
    fn from(document: MarkdownDocument) -> Self {
        Self {
            file_name: document.file_name,
            path: document.path,
            content: document.content,
            size_bytes: document.size_bytes,
            modified_at_ms: document.modified_at_ms,
        }
    }
}
