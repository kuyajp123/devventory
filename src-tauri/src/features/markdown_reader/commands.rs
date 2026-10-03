use tauri::{State, WebviewWindow};

use super::document::read_markdown_document;
use super::dto::MarkdownDocumentDto;
use super::error::MarkdownReaderError;
use super::state::MarkdownReaderState;
use super::window::MARKDOWN_READER_WINDOW_LABEL;
use crate::shared::errors::command::CommandError;

#[tauri::command]
pub(crate) async fn get_markdown_reader_document(
    window: WebviewWindow,
    state: State<'_, MarkdownReaderState>,
) -> Result<MarkdownDocumentDto, CommandError> {
    if window.label() != MARKDOWN_READER_WINDOW_LABEL {
        return Err(MarkdownReaderError::WrongWindow.into());
    }

    let path = state.current().ok_or(MarkdownReaderError::NoDocument)?;
    let document = tokio::task::spawn_blocking(move || read_markdown_document(&path))
        .await
        .map_err(|_| MarkdownReaderError::RuntimeUnavailable)??;
    Ok(document.into())
}
