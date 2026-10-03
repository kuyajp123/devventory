use std::path::{Path, PathBuf};

const MARKDOWN_EXTENSIONS: [&str; 2] = ["md", "markdown"];

/// Returns `true` when the path ends in a Markdown extension (case-insensitive).
pub(crate) fn has_markdown_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            MARKDOWN_EXTENSIONS
                .iter()
                .any(|candidate| extension.eq_ignore_ascii_case(candidate))
        })
}

/// Finds the first Markdown document in process launch arguments.
///
/// The first argument is the executable path and is always skipped. Flags such
/// as `--autostart` are ignored, and relative paths are resolved against `cwd`
/// so that launches from a terminal behave like launches from Windows Explorer.
pub(crate) fn markdown_path_from_args<I, S>(args: I, cwd: &Path) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().skip(1).find_map(|argument| {
        let argument = argument.as_ref().trim();
        if argument.is_empty() || argument.starts_with('-') {
            return None;
        }

        let candidate = Path::new(argument);
        if !has_markdown_extension(candidate) {
            return None;
        }

        Some(if candidate.is_absolute() {
            candidate.to_path_buf()
        } else {
            cwd.join(candidate)
        })
    })
}
