use std::fs;
use std::path::{Path, PathBuf};
use tempfile::tempdir;

use super::document::{read_markdown_document, MAX_DOCUMENT_SIZE_BYTES};
use super::error::MarkdownReaderError;
use super::launch::{has_markdown_extension, markdown_path_from_args};
use super::state::MarkdownReaderState;
use crate::shared::errors::command::CommandError;

#[test]
fn detects_valid_markdown_extensions_case_insensitively() {
    assert!(has_markdown_extension(Path::new("README.md")));
    assert!(has_markdown_extension(Path::new("DOCS.MARKDOWN")));
    assert!(has_markdown_extension(Path::new("notes.Md")));
    assert!(!has_markdown_extension(Path::new("script.rs")));
    assert!(!has_markdown_extension(Path::new("data.json")));
    assert!(!has_markdown_extension(Path::new(".env")));
    assert!(!has_markdown_extension(Path::new("no_extension")));
}

#[test]
fn extracts_markdown_path_from_launch_args() {
    let cwd = Path::new("C:/test/project");

    // Case 1: Standard launch with .md argument
    let args = vec!["devventory.exe", "README.md"];
    let result = markdown_path_from_args(args, cwd);
    assert_eq!(result, Some(cwd.join("README.md")));

    // Case 2: Launch with flags before file
    let args_with_flags = vec!["devventory.exe", "--debug", "docs/architecture.markdown"];
    let result = markdown_path_from_args(args_with_flags, cwd);
    assert_eq!(result, Some(cwd.join("docs/architecture.markdown")));

    // Case 3: Absolute path
    let absolute_path = "C:/docs/guide.md";
    let args_abs = vec!["devventory.exe", absolute_path];
    let result = markdown_path_from_args(args_abs, cwd);
    assert_eq!(result, Some(PathBuf::from(absolute_path)));

    // Case 4: No markdown arguments
    let args_none = vec!["devventory.exe", "--autostart", "some_file.txt"];
    let result = markdown_path_from_args(args_none, cwd);
    assert_eq!(result, None);
}

#[test]
fn reads_valid_markdown_document_and_strips_bom() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("test.md");

    let sample_text = "\u{feff}# Hello World\nThis is a test.";
    fs::write(&file_path, sample_text).expect("write file");

    let doc = read_markdown_document(&file_path).expect("read document");
    assert_eq!(doc.file_name, "test.md");
    assert_eq!(doc.content, "# Hello World\nThis is a test.");
    assert!(doc.size_bytes > 0);
}

#[test]
fn rejects_non_existent_file() {
    let dir = tempdir().expect("temp dir");
    let missing_path = dir.path().join("missing.md");

    let err = read_markdown_document(&missing_path).expect_err("should fail");
    assert_eq!(err, MarkdownReaderError::NotFound);
}

#[test]
fn rejects_non_markdown_extensions() {
    let dir = tempdir().expect("temp dir");
    let txt_path = dir.path().join("notes.txt");
    fs::write(&txt_path, "Hello").expect("write file");

    let err = read_markdown_document(&txt_path).expect_err("should fail");
    assert_eq!(err, MarkdownReaderError::UnsupportedFile);
}

#[test]
fn rejects_files_exceeding_max_preview_size() {
    let dir = tempdir().expect("temp dir");
    let large_path = dir.path().join("large.md");

    // File slightly larger than 2 MB
    let oversized = vec![b'a'; (MAX_DOCUMENT_SIZE_BYTES + 10) as usize];
    fs::write(&large_path, oversized).expect("write large file");

    let err = read_markdown_document(&large_path).expect_err("should fail");
    assert_eq!(err, MarkdownReaderError::TooLarge);
}

#[test]
fn state_records_and_retrieves_current_document() {
    let state = MarkdownReaderState::new();
    assert_eq!(state.current(), None);

    let doc_path = PathBuf::from("C:/notes/test.md");
    state.set_current(doc_path.clone());
    assert_eq!(state.current(), Some(doc_path));
}

#[test]
fn command_errors_are_safely_mapped() {
    let not_found = CommandError::from(MarkdownReaderError::NotFound);
    assert_eq!(not_found.code(), "NOT_FOUND");

    let unsupported = CommandError::from(MarkdownReaderError::UnsupportedFile);
    assert_eq!(unsupported.code(), "INVALID_INPUT");

    let too_large = CommandError::from(MarkdownReaderError::TooLarge);
    assert_eq!(too_large.code(), "OPERATION_UNAVAILABLE");
}
