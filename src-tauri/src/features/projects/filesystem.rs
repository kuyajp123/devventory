use std::collections::HashSet;
use std::fs::{self, FileType};
use std::path::{Component, Path, PathBuf};
use std::time::Instant;

use super::error::ProjectError;
use super::model::{InitialScanSummary, ValidatedProjectConfiguration, ValidatedWatchedLocation};

const MAX_EXCLUSIONS: usize = 128;
const MAX_WATCHED_LOCATIONS: usize = 32;
const MAX_SCAN_ENTRIES: u64 = 1_000_000;

#[derive(Debug, Clone, Copy)]
pub(crate) struct LocalProjectFilesystem;

impl LocalProjectFilesystem {
    pub(super) fn validate_root(&self, root_path: &str) -> Result<String, ProjectError> {
        let root_path = root_path.trim();
        let requested = Path::new(root_path);

        if !requested.is_absolute() {
            return Err(ProjectError::RootNotAbsolute);
        }

        let canonical = canonicalize_root(requested)?;
        ensure_readable_directory(&canonical, true)?;
        display_path(&canonical)
    }

    pub(super) fn validate_configuration(
        &self,
        root_path: &str,
        watched_locations: &[String],
        exclusions: &[String],
    ) -> Result<ValidatedProjectConfiguration, ProjectError> {
        if watched_locations.is_empty() || watched_locations.len() > MAX_WATCHED_LOCATIONS {
            return Err(ProjectError::TooManyWatchedLocations);
        }
        if exclusions.len() > MAX_EXCLUSIONS {
            return Err(ProjectError::TooManyExclusions);
        }

        let requested = Path::new(root_path.trim());
        if !requested.is_absolute() {
            return Err(ProjectError::RootNotAbsolute);
        }

        let root_path = canonicalize_root(requested)?;
        ensure_readable_directory(&root_path, true)?;
        let root_path_display = display_path(&root_path)?;
        let root_path_key = root_key(&root_path_display);

        let mut validated_locations = Vec::with_capacity(watched_locations.len());
        let mut unique_locations = HashSet::new();

        for watched_location in watched_locations {
            let relative = normalize_relative_path(watched_location, true)?;
            let requested_location = if relative == "." {
                root_path.clone()
            } else {
                root_path.join(&relative)
            };
            if contains_link_or_reparse_component(&root_path, &requested_location)
                .map_err(|_| ProjectError::WatchedLocationUnreadable)?
            {
                return Err(ProjectError::WatchedLocationLinkNotAllowed);
            }
            let absolute_path = canonicalize_watched_location(&requested_location)?;

            if absolute_path.strip_prefix(&root_path).is_err() {
                return Err(ProjectError::WatchedLocationOutsideRoot);
            }
            ensure_readable_directory(&absolute_path, false)?;

            if unique_locations.insert(absolute_path.clone()) {
                let relative_path = relative_from_root(&root_path, &absolute_path)?;
                validated_locations.push(ValidatedWatchedLocation {
                    relative_path,
                    absolute_path,
                });
            }
        }

        validated_locations.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

        let mut normalized_exclusions = exclusions
            .iter()
            .map(|exclusion| normalize_exclusion(exclusion))
            .collect::<Result<Vec<_>, _>>()?;
        normalized_exclusions.sort();
        normalized_exclusions.dedup();

        Ok(ValidatedProjectConfiguration {
            root_path,
            root_path_display,
            root_path_key,
            watched_locations: validated_locations,
            exclusions: normalized_exclusions,
        })
    }

    pub(super) fn scan(&self, configuration: &ValidatedProjectConfiguration) -> InitialScanSummary {
        let started_at = Instant::now();
        let mut summary = InitialScanSummary {
            files_discovered: 0,
            directories_visited: 0,
            entries_excluded: 0,
            entries_unreadable: 0,
            duration_ms: 0,
            completed: true,
        };
        let mut pending = configuration
            .watched_locations
            .iter()
            .map(|location| location.absolute_path.clone())
            .collect::<Vec<_>>();
        let mut visited = HashSet::new();
        let mut processed_entries = 0_u64;

        'scan: while let Some(directory) = pending.pop() {
            if !visited.insert(directory.clone()) {
                continue;
            }

            let entries = match fs::read_dir(&directory) {
                Ok(entries) => entries,
                Err(_) => {
                    summary.entries_unreadable += 1;
                    summary.completed = false;
                    continue;
                }
            };
            summary.directories_visited += 1;

            for entry in entries {
                if processed_entries >= MAX_SCAN_ENTRIES {
                    summary.completed = false;
                    break 'scan;
                }
                processed_entries += 1;

                let entry = match entry {
                    Ok(entry) => entry,
                    Err(_) => {
                        summary.entries_unreadable += 1;
                        summary.completed = false;
                        continue;
                    }
                };
                let path = entry.path();
                let relative = match path.strip_prefix(&configuration.root_path) {
                    Ok(relative) => path_to_portable_string(relative),
                    Err(_) => {
                        summary.entries_excluded += 1;
                        continue;
                    }
                };

                if is_excluded(&relative, &configuration.exclusions) {
                    summary.entries_excluded += 1;
                    continue;
                }

                let file_type = match entry.file_type() {
                    Ok(file_type) => file_type,
                    Err(_) => {
                        summary.entries_unreadable += 1;
                        summary.completed = false;
                        continue;
                    }
                };

                match is_link_or_reparse_point(&path, &file_type) {
                    Ok(true) => summary.entries_excluded += 1,
                    Ok(false) if file_type.is_dir() => pending.push(path),
                    Ok(false) if file_type.is_file() => summary.files_discovered += 1,
                    Ok(false) => summary.entries_excluded += 1,
                    Err(_) => {
                        summary.entries_unreadable += 1;
                        summary.completed = false;
                    }
                }
            }
        }

        summary.duration_ms = u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX);
        summary
    }
}

fn canonicalize_root(path: &Path) -> Result<PathBuf, ProjectError> {
    match fs::canonicalize(path) {
        Ok(path) => Ok(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Err(ProjectError::RootNotFound)
        }
        Err(_) => Err(ProjectError::RootNotReadable),
    }
}

fn canonicalize_watched_location(path: &Path) -> Result<PathBuf, ProjectError> {
    match fs::canonicalize(path) {
        Ok(path) => Ok(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Err(ProjectError::WatchedLocationNotFound)
        }
        Err(_) => Err(ProjectError::WatchedLocationUnreadable),
    }
}

fn ensure_readable_directory(path: &Path, root: bool) -> Result<(), ProjectError> {
    let metadata = fs::metadata(path).map_err(|_| {
        if root {
            ProjectError::RootNotReadable
        } else {
            ProjectError::WatchedLocationUnreadable
        }
    })?;
    if !metadata.is_dir() {
        return Err(if root {
            ProjectError::RootNotDirectory
        } else {
            ProjectError::WatchedLocationNotDirectory
        });
    }
    fs::read_dir(path).map_err(|_| {
        if root {
            ProjectError::RootNotReadable
        } else {
            ProjectError::WatchedLocationUnreadable
        }
    })?;
    Ok(())
}

fn normalize_relative_path(value: &str, allow_root: bool) -> Result<String, ProjectError> {
    let portable = value.trim().replace('\\', "/");
    let path = Path::new(&portable);
    if path.is_absolute() {
        return Err(ProjectError::WatchedLocationOutsideRoot);
    }

    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => parts.push(
                part.to_str()
                    .ok_or(ProjectError::RootPathEncoding)?
                    .to_owned(),
            ),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(ProjectError::WatchedLocationOutsideRoot);
            }
        }
    }

    if parts.is_empty() {
        return if allow_root {
            Ok(".".to_owned())
        } else {
            Err(ProjectError::InvalidExclusion)
        };
    }
    Ok(parts.join("/"))
}

fn normalize_exclusion(value: &str) -> Result<String, ProjectError> {
    let normalized = normalize_relative_path(value.trim_matches(['/', '\\']), false)
        .map_err(|_| ProjectError::InvalidExclusion)?;
    Ok(format!("{normalized}/"))
}

fn relative_from_root(root: &Path, path: &Path) -> Result<String, ProjectError> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| ProjectError::WatchedLocationOutsideRoot)?;
    if relative.as_os_str().is_empty() {
        Ok(".".to_owned())
    } else {
        Ok(path_to_portable_string(relative))
    }
}

fn path_to_portable_string(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn is_excluded(relative_path: &str, exclusions: &[String]) -> bool {
    exclusions.iter().any(|exclusion| {
        let prefix = exclusion.trim_end_matches('/');
        relative_path == prefix || relative_path.starts_with(&format!("{prefix}/"))
    })
}

fn display_path(path: &Path) -> Result<String, ProjectError> {
    let value = path.to_str().ok_or(ProjectError::RootPathEncoding)?;

    #[cfg(windows)]
    {
        if let Some(network_path) = value.strip_prefix(r"\\?\UNC\") {
            return Ok(format!(r"\\{network_path}"));
        }
        if let Some(local_path) = value.strip_prefix(r"\\?\") {
            return Ok(local_path.to_owned());
        }
    }

    Ok(value.to_owned())
}

fn root_key(display_path: &str) -> String {
    #[cfg(windows)]
    {
        display_path.to_lowercase()
    }

    #[cfg(not(windows))]
    {
        display_path.to_owned()
    }
}

fn is_link_or_reparse_point(path: &Path, file_type: &FileType) -> std::io::Result<bool> {
    if file_type.is_symlink() {
        return Ok(true);
    }

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        let attributes = fs::symlink_metadata(path)?.file_attributes();
        Ok(attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0)
    }

    #[cfg(not(windows))]
    {
        let _ = path;
        Ok(false)
    }
}

fn contains_link_or_reparse_component(root: &Path, path: &Path) -> std::io::Result<bool> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| std::io::Error::other("path is outside root"))?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Ok(true);
        };
        current.push(part);
        let metadata = fs::symlink_metadata(&current)?;
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
