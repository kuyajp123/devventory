use std::path::Path;

use super::model::FileCategory;

pub(crate) fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty() && value.chars().count() <= 32)
        .map(str::to_lowercase)
}

pub(crate) fn mime_type(path: &Path) -> Option<String> {
    mime_guess::from_path(path)
        .first_raw()
        .map(ToOwned::to_owned)
}

pub(crate) fn category(path: &Path) -> FileCategory {
    let Some(extension) = extension(path) else {
        return FileCategory::Other;
    };

    match extension.as_str() {
        "c" | "cc" | "cpp" | "cs" | "css" | "dart" | "go" | "h" | "hpp" | "html" | "java"
        | "js" | "jsx" | "kt" | "kts" | "php" | "py" | "rb" | "rs" | "scss" | "sh" | "sql"
        | "svelte" | "swift" | "ts" | "tsx" | "vue" => FileCategory::Source,
        "cfg" | "conf" | "config" | "ini" | "json" | "properties" | "toml" | "xml" | "yaml"
        | "yml" => FileCategory::Configuration,
        "csv" | "doc" | "docx" | "epub" | "md" | "odt" | "pdf" | "ppt" | "pptx" | "rtf" | "txt"
        | "xls" | "xlsx" => FileCategory::Document,
        "avif" | "bmp" | "gif" | "heic" | "ico" | "jpeg" | "jpg" | "png" | "svg" | "tif"
        | "tiff" | "webp" => FileCategory::Image,
        "aac" | "flac" | "m4a" | "mp3" | "ogg" | "opus" | "wav" | "wma" => FileCategory::Audio,
        "avi" | "m4v" | "mkv" | "mov" | "mp4" | "mpeg" | "mpg" | "webm" | "wmv" => {
            FileCategory::Video
        }
        "7z" | "bz2" | "gz" | "rar" | "tar" | "tgz" | "xz" | "zip" => FileCategory::Archive,
        "eot" | "otf" | "ttf" | "woff" | "woff2" => FileCategory::Font,
        _ => FileCategory::Other,
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{category, extension, mime_type};
    use crate::features::file_inventory::model::FileCategory;

    #[test]
    fn categorizes_extensions_deterministically_and_uses_other_as_fallback() {
        assert_eq!(category(Path::new("src/App.TSX")), FileCategory::Source);
        assert_eq!(
            category(Path::new("settings.toml")),
            FileCategory::Configuration
        );
        assert_eq!(category(Path::new("cover.webp")), FileCategory::Image);
        assert_eq!(category(Path::new("unknown.custom")), FileCategory::Other);
        assert_eq!(category(Path::new("LICENSE")), FileCategory::Other);
        assert_eq!(
            extension(Path::new("archive.TAR.GZ")),
            Some("gz".to_owned())
        );
    }

    #[test]
    fn guesses_mime_from_the_path_without_reading_contents() {
        assert_eq!(
            mime_type(Path::new("notes.txt")).as_deref(),
            Some("text/plain")
        );
        assert_eq!(mime_type(Path::new("README")), None);
    }
}
