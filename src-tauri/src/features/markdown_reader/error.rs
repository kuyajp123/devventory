use thiserror::Error;

use crate::shared::errors::command::CommandError;

#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum MarkdownReaderError {
    #[error("no markdown document is open")]
    NoDocument,
    #[error("markdown document was not found")]
    NotFound,
    #[error("file is not a markdown document")]
    UnsupportedFile,
    #[error("markdown document is not valid UTF-8 text")]
    NotText,
    #[error("markdown document exceeds the preview limit")]
    TooLarge,
    #[error("markdown document cannot be read")]
    Unreadable,
    #[error("markdown reader is unavailable from this window")]
    WrongWindow,
    #[error("markdown reader runtime is unavailable")]
    RuntimeUnavailable,
}

impl From<MarkdownReaderError> for CommandError {
    fn from(error: MarkdownReaderError) -> Self {
        match error {
            MarkdownReaderError::NoDocument | MarkdownReaderError::NotFound => Self::not_found(
                "The Markdown file could not be found. It may have been moved or deleted.",
            ),
            MarkdownReaderError::UnsupportedFile | MarkdownReaderError::NotText => {
                Self::invalid_input(
                    "Only UTF-8 Markdown files (.md, .markdown) can be opened in the reader.",
                )
            }
            MarkdownReaderError::TooLarge => Self::operation_unavailable(
                "The Markdown file is too large to preview safely (limit: 2 MB).",
            ),
            MarkdownReaderError::Unreadable | MarkdownReaderError::RuntimeUnavailable => {
                Self::filesystem_unavailable(
                    "The Markdown file cannot be read. Check its permissions.",
                )
            }
            MarkdownReaderError::WrongWindow => {
                Self::invalid_input("The Markdown reader is only available in its own window.")
            }
        }
    }
}
