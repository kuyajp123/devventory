use std::fs;

use crate::features::projects::{
    is_link_or_reparse_point, is_project_path_excluded, ResolvedProjectDirectory,
};

use super::error::FileInventoryError;
use super::model::{ProjectDirectoryEntry, ProjectDirectoryPage};

const MAX_DIRECTORY_ENTRIES_SCANNED: usize = 50_000;

#[derive(Debug, Clone, Copy, Default)]
pub(super) struct LocalDirectoryLister;

impl LocalDirectoryLister {
    pub(super) fn list(
        &self,
        target: ResolvedProjectDirectory,
        page: u32,
        page_size: u32,
    ) -> Result<ProjectDirectoryPage, FileInventoryError> {
        let mut directories = Vec::new();
        let mut entries_unreadable = 0_u64;
        let entries = fs::read_dir(&target.absolute_path)?;

        for (index, entry) in entries.enumerate() {
            if index >= MAX_DIRECTORY_ENTRIES_SCANNED {
                return Err(FileInventoryError::DirectoryTooLarge);
            }
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => {
                    entries_unreadable += 1;
                    continue;
                }
            };
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => {
                    entries_unreadable += 1;
                    continue;
                }
            };
            if !file_type.is_dir() {
                continue;
            }
            match is_link_or_reparse_point(&path, &file_type) {
                Ok(true) => continue,
                Ok(false) => {}
                Err(_) => {
                    entries_unreadable += 1;
                    continue;
                }
            }
            match fs::canonicalize(&path) {
                Ok(path) if path.strip_prefix(&target.root_path).is_ok() => {}
                Ok(_) => continue,
                Err(_) => {
                    entries_unreadable += 1;
                    continue;
                }
            }
            let Some(name) = entry.file_name().to_str().map(ToOwned::to_owned) else {
                entries_unreadable += 1;
                continue;
            };
            let relative_path = if target.relative_path == "." {
                name.clone()
            } else {
                format!("{}/{}", target.relative_path, name)
            };
            if is_project_path_excluded(&relative_path, true, &target.exclusions) {
                continue;
            }
            directories.push(ProjectDirectoryEntry {
                is_watched: target
                    .watched_locations
                    .iter()
                    .any(|watched| paths_equal(&watched.relative_path, &relative_path)),
                name,
                relative_path,
            });
        }

        directories.sort_by(|left, right| {
            left.name
                .to_lowercase()
                .cmp(&right.name.to_lowercase())
                .then_with(|| left.name.cmp(&right.name))
        });
        let total_items = u64::try_from(directories.len())
            .map_err(|_| FileInventoryError::InvalidPersistedData)?;
        let total_pages_u64 = total_items.div_ceil(u64::from(page_size));
        let total_pages =
            u32::try_from(total_pages_u64).map_err(|_| FileInventoryError::InvalidPersistedData)?;
        let offset = u64::from(page.saturating_sub(1)) * u64::from(page_size);
        let start = usize::try_from(offset).unwrap_or(usize::MAX);
        let items = directories
            .into_iter()
            .skip(start)
            .take(usize::try_from(page_size).map_err(|_| FileInventoryError::InvalidPersistedData)?)
            .collect();

        Ok(ProjectDirectoryPage {
            entries_unreadable,
            has_more: page < total_pages,
            items,
            page,
            page_size,
            total_items,
            total_pages,
        })
    }
}

fn paths_equal(left: &str, right: &str) -> bool {
    #[cfg(windows)]
    {
        left.eq_ignore_ascii_case(right)
    }

    #[cfg(not(windows))]
    {
        left == right
    }
}
