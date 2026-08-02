use std::ffi::OsStr;
use std::fmt::Write as _;
use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::features::projects::ResolvedProjectScanTarget;

use super::error::AssetError;
use super::model::{ResolvedDestination, SourceFile};

const STREAM_BUFFER_SIZE: usize = 64 * 1024;

#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct LocalAssetFilesystem;

#[derive(Debug)]
pub(super) struct PreparedCopy {
    pub(super) temp_path: PathBuf,
    pub(super) content_hash: String,
    pub(super) bytes_copied: u64,
}

#[derive(Debug)]
pub(super) struct InstalledFile {
    pub(super) final_path: PathBuf,
    backup_path: Option<PathBuf>,
}

impl LocalAssetFilesystem {
    pub(super) fn preview_source(&self, source_path: &str) -> Result<SourceFile, AssetError> {
        let requested = Path::new(source_path.trim());
        if !requested.is_absolute() {
            return Err(AssetError::SourceInvalid);
        }
        let canonical_path = fs::canonicalize(requested).map_err(|_| AssetError::SourceInvalid)?;
        let metadata = fs::metadata(&canonical_path).map_err(|_| AssetError::SourceInvalid)?;
        if !metadata.is_file() {
            return Err(AssetError::SourceInvalid);
        }
        File::open(&canonical_path).map_err(|_| AssetError::SourceInvalid)?;
        let name = canonical_path
            .file_name()
            .and_then(OsStr::to_str)
            .ok_or(AssetError::SourceInvalid)?
            .to_owned();
        validate_filename(&name)?;
        Ok(SourceFile {
            canonical_path,
            name,
            size_bytes: metadata.len(),
            modified_at_ms: modified_at_ms(&metadata),
        })
    }

    pub(super) fn resolve_destination(
        &self,
        project: &ResolvedProjectScanTarget,
        relative_directory: &str,
        filename: &str,
    ) -> Result<ResolvedDestination, AssetError> {
        let relative_directory = normalize_relative_directory(relative_directory)?;
        let filename = validate_filename(filename)?.to_owned();
        let requested = if relative_directory == "." {
            project.root_path.clone()
        } else {
            project.root_path.join(&relative_directory)
        };
        if contains_link_component(&project.root_path, &requested)? {
            return Err(AssetError::DestinationLinkNotAllowed);
        }
        let directory = fs::canonicalize(&requested).map_err(|_| AssetError::DestinationInvalid)?;
        let metadata = fs::metadata(&directory).map_err(|_| AssetError::DestinationInvalid)?;
        if !metadata.is_dir() || directory.strip_prefix(&project.root_path).is_err() {
            return Err(AssetError::DestinationOutsideRoot);
        }
        let watched = project
            .watched_locations
            .iter()
            .filter(|location| directory.starts_with(&location.absolute_path))
            .max_by_key(|location| location.absolute_path.components().count())
            .ok_or(AssetError::DestinationOutsideRoot)?;
        Ok(ResolvedDestination {
            directory,
            relative_directory,
            filename,
            watched_location_id: watched.id,
        })
    }

    pub(super) fn hash_file(&self, path: &Path) -> Result<String, AssetError> {
        let mut reader = BufReader::with_capacity(STREAM_BUFFER_SIZE, File::open(path)?);
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; STREAM_BUFFER_SIZE];
        loop {
            let read = reader.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
        }
        Ok(hex_digest(hasher.finalize().as_ref()))
    }

    pub(super) fn prepare_copy(
        &self,
        source: &Path,
        destination: &Path,
        import_id: Uuid,
    ) -> Result<PreparedCopy, AssetError> {
        let temp_path = destination.join(format!(".devventory-import-{import_id}.tmp"));
        let input = File::open(source)?;
        let output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)?;
        let mut reader = BufReader::with_capacity(STREAM_BUFFER_SIZE, input);
        let mut writer = BufWriter::with_capacity(STREAM_BUFFER_SIZE, output);
        let mut hasher = Sha256::new();
        let mut bytes_copied = 0_u64;
        let mut buffer = [0_u8; STREAM_BUFFER_SIZE];
        let copy_result = (|| -> Result<(), std::io::Error> {
            loop {
                let read = reader.read(&mut buffer)?;
                if read == 0 {
                    break;
                }
                writer.write_all(&buffer[..read])?;
                hasher.update(&buffer[..read]);
                bytes_copied = bytes_copied.saturating_add(read as u64);
            }
            writer.flush()?;
            writer.get_ref().sync_all()?;
            Ok(())
        })();
        if let Err(error) = copy_result {
            drop(writer);
            let _ = fs::remove_file(&temp_path);
            return Err(error.into());
        }
        Ok(PreparedCopy {
            temp_path,
            content_hash: hex_digest(hasher.finalize().as_ref()),
            bytes_copied,
        })
    }

    pub(super) fn validate_destination_directory(
        &self,
        root: &Path,
        directory: &Path,
    ) -> Result<(), AssetError> {
        if directory.strip_prefix(root).is_err() || contains_link_component(root, directory)? {
            return Err(AssetError::DestinationLinkNotAllowed);
        }
        let current = fs::canonicalize(directory).map_err(|_| AssetError::DestinationInvalid)?;
        if current != directory || !current.is_dir() {
            return Err(AssetError::DestinationOutsideRoot);
        }
        Ok(())
    }

    pub(super) fn install_new(
        &self,
        prepared: PreparedCopy,
        final_path: PathBuf,
    ) -> Result<InstalledFile, AssetError> {
        match fs::hard_link(&prepared.temp_path, &final_path) {
            Ok(()) => {
                fs::remove_file(&prepared.temp_path)?;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let _ = fs::remove_file(&prepared.temp_path);
                return Err(AssetError::Collision);
            }
            Err(_) => {
                let mut source = File::open(&prepared.temp_path)?;
                let mut destination = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&final_path)
                    .map_err(|error| {
                        let _ = fs::remove_file(&prepared.temp_path);
                        if error.kind() == std::io::ErrorKind::AlreadyExists {
                            AssetError::Collision
                        } else {
                            AssetError::Filesystem(error)
                        }
                    })?;
                if let Err(error) = std::io::copy(&mut source, &mut destination)
                    .and_then(|_| destination.sync_all())
                {
                    let _ = fs::remove_file(&final_path);
                    let _ = fs::remove_file(&prepared.temp_path);
                    return Err(error.into());
                }
                fs::remove_file(&prepared.temp_path)?;
            }
        }
        Ok(InstalledFile {
            final_path,
            backup_path: None,
        })
    }

    pub(super) fn install_replace(
        &self,
        prepared: PreparedCopy,
        final_path: PathBuf,
        import_id: Uuid,
    ) -> Result<InstalledFile, AssetError> {
        let backup_path =
            final_path.with_file_name(format!(".devventory-replaced-{import_id}.bak"));
        let backup = if final_path.exists() {
            fs::rename(&final_path, &backup_path)?;
            Some(backup_path)
        } else {
            None
        };
        if let Err(error) = fs::rename(&prepared.temp_path, &final_path) {
            if let Some(backup) = &backup {
                let _ = fs::rename(backup, &final_path);
            }
            let _ = fs::remove_file(&prepared.temp_path);
            return Err(error.into());
        }
        Ok(InstalledFile {
            final_path,
            backup_path: backup,
        })
    }

    pub(super) fn keep_both_path(&self, requested: &Path) -> Result<PathBuf, AssetError> {
        if !requested.exists() {
            return Ok(requested.to_path_buf());
        }
        let stem = requested
            .file_stem()
            .and_then(OsStr::to_str)
            .ok_or(AssetError::InvalidFilename)?;
        let extension = requested.extension().and_then(OsStr::to_str);
        for index in 1..=10_000_u32 {
            let filename = match extension {
                Some(extension) => format!("{stem} ({index}).{extension}"),
                None => format!("{stem} ({index})"),
            };
            let candidate = requested.with_file_name(filename);
            if !candidate.exists() {
                return Ok(candidate);
            }
        }
        Err(AssetError::Collision)
    }

    pub(super) fn rollback(&self, installed: &InstalledFile) {
        let _ = fs::remove_file(&installed.final_path);
        if let Some(backup) = &installed.backup_path {
            let _ = fs::rename(backup, &installed.final_path);
        }
    }

    pub(super) fn commit(&self, installed: &InstalledFile) {
        if let Some(backup) = &installed.backup_path {
            let _ = fs::remove_file(backup);
        }
    }

    pub(super) fn cleanup_temp(&self, prepared: &PreparedCopy) {
        let _ = fs::remove_file(&prepared.temp_path);
    }

    pub(super) fn validate_action_path(
        &self,
        root: &Path,
        relative_path: &str,
    ) -> Result<PathBuf, AssetError> {
        let relative = normalize_relative_file(relative_path)?;
        let requested = root.join(relative);
        let canonical = fs::canonicalize(&requested).map_err(|_| AssetError::NotFound)?;
        if canonical.strip_prefix(root).is_err() || !canonical.is_file() {
            return Err(AssetError::NotFound);
        }
        if contains_link_component(root, &requested)? {
            return Err(AssetError::DestinationLinkNotAllowed);
        }
        Ok(canonical)
    }

    pub(super) fn inspect_action_path(
        &self,
        root: &Path,
        relative_path: &str,
    ) -> Result<(PathBuf, u64, Option<i64>), AssetError> {
        let path = self.validate_action_path(root, relative_path)?;
        let metadata = fs::metadata(&path).map_err(|_| AssetError::NotFound)?;
        Ok((path, metadata.len(), modified_at_ms(&metadata)))
    }
}

fn normalize_relative_directory(value: &str) -> Result<String, AssetError> {
    normalize_relative(value, true)
}

fn normalize_relative_file(value: &str) -> Result<String, AssetError> {
    normalize_relative(value, false)
}

fn normalize_relative(value: &str, allow_root: bool) -> Result<String, AssetError> {
    let portable = value.trim().replace('\\', "/");
    let path = Path::new(&portable);
    if path.is_absolute() {
        return Err(AssetError::DestinationOutsideRoot);
    }
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => parts.push(
                part.to_str()
                    .ok_or(AssetError::DestinationInvalid)?
                    .to_owned(),
            ),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(AssetError::DestinationOutsideRoot);
            }
        }
    }
    if parts.is_empty() {
        if allow_root {
            Ok(".".to_owned())
        } else {
            Err(AssetError::DestinationInvalid)
        }
    } else {
        Ok(parts.join("/"))
    }
}

fn validate_filename(value: &str) -> Result<&str, AssetError> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 255
        || value.ends_with(['.', ' '])
        || value.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
    {
        return Err(AssetError::InvalidFilename);
    }
    let stem = value
        .split('.')
        .next()
        .unwrap_or(value)
        .to_ascii_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'));
    if reserved {
        return Err(AssetError::InvalidFilename);
    }
    Ok(value)
}

fn contains_link_component(root: &Path, path: &Path) -> Result<bool, AssetError> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| AssetError::DestinationOutsideRoot)?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Ok(true);
        };
        current.push(part);
        let metadata =
            fs::symlink_metadata(&current).map_err(|_| AssetError::DestinationInvalid)?;
        if metadata.file_type().is_symlink() {
            return Ok(true);
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
            if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn modified_at_ms(metadata: &fs::Metadata) -> Option<i64> {
    let duration = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?;
    i64::try_from(duration.as_millis()).ok()
}

pub(super) fn portable_path(directory: &str, filename: &str) -> String {
    if directory == "." {
        filename.to_owned()
    } else {
        format!("{directory}/{filename}")
    }
}

fn hex_digest(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(output, "{byte:02x}");
    }
    output
}
