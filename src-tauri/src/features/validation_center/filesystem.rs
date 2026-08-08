use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
};

use uuid::Uuid;

use super::{error::ValidationError, model::ManifestCollisionChoice};

#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct LocalManifestFilesystem;

impl LocalManifestFilesystem {
    pub(crate) fn exists(
        &self,
        project_root: &str,
        relative_path: &str,
    ) -> Result<bool, ValidationError> {
        let destination = resolve_destination(project_root, relative_path)?;
        Ok(destination.is_file())
    }

    pub(crate) fn write_atomic(
        &self,
        project_root: &str,
        relative_path: &str,
        content: &str,
        collision_choice: ManifestCollisionChoice,
    ) -> Result<bool, ValidationError> {
        let destination = resolve_destination(project_root, relative_path)?;
        let existed = destination.exists();
        if existed && collision_choice == ManifestCollisionChoice::Cancel {
            return Err(ValidationError::ManifestConflict);
        }

        let parent = destination
            .parent()
            .ok_or(ValidationError::ManifestPathInvalid)?;
        let temporary = parent.join(format!(".devventory-manifest-{}.tmp", Uuid::new_v4()));
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        if let Err(error) = write_and_sync(&mut file, content.as_bytes()) {
            drop(file);
            let _ = fs::remove_file(&temporary);
            return Err(error.into());
        }
        drop(file);

        if !existed {
            if let Err(error) = fs::rename(&temporary, &destination) {
                let _ = fs::remove_file(&temporary);
                return Err(error.into());
            }
            return Ok(false);
        }

        let backup = parent.join(format!(".devventory-manifest-{}.bak", Uuid::new_v4()));
        if let Err(error) = fs::rename(&destination, &backup) {
            let _ = fs::remove_file(&temporary);
            return Err(error.into());
        }
        if let Err(error) = fs::rename(&temporary, &destination) {
            let restore_result = fs::rename(&backup, &destination);
            let _ = fs::remove_file(&temporary);
            if restore_result.is_err() {
                return Err(ValidationError::RuntimeUnavailable);
            }
            return Err(error.into());
        }
        fs::remove_file(&backup)?;
        Ok(true)
    }
}

fn resolve_destination(
    project_root: &str,
    relative_path: &str,
) -> Result<PathBuf, ValidationError> {
    let root = fs::canonicalize(project_root).map_err(|_| ValidationError::ManifestPathInvalid)?;
    if !root.is_dir() {
        return Err(ValidationError::ManifestPathInvalid);
    }
    let relative = normalize_relative_path(relative_path)?;
    let requested = root.join(relative);
    let parent = requested
        .parent()
        .ok_or(ValidationError::ManifestPathInvalid)?;
    reject_link_components(&root, parent)?;
    let canonical_parent =
        fs::canonicalize(parent).map_err(|_| ValidationError::ManifestPathInvalid)?;
    if canonical_parent.strip_prefix(&root).is_err() {
        return Err(ValidationError::ManifestPathInvalid);
    }
    let destination = canonical_parent.join(
        requested
            .file_name()
            .ok_or(ValidationError::ManifestPathInvalid)?,
    );
    if destination.exists() {
        let metadata =
            fs::symlink_metadata(&destination).map_err(|_| ValidationError::ManifestPathInvalid)?;
        if is_link_or_reparse(&metadata) || !metadata.is_file() {
            return Err(ValidationError::ManifestPathInvalid);
        }
        let canonical =
            fs::canonicalize(&destination).map_err(|_| ValidationError::ManifestPathInvalid)?;
        if canonical.strip_prefix(&root).is_err() {
            return Err(ValidationError::ManifestPathInvalid);
        }
        return Ok(canonical);
    }
    Ok(destination)
}

fn normalize_relative_path(value: &str) -> Result<PathBuf, ValidationError> {
    let portable = value.trim().replace('\\', "/");
    let path = Path::new(&portable);
    if path.is_absolute() {
        return Err(ValidationError::ManifestPathInvalid);
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(ValidationError::ManifestPathInvalid)
            }
        }
    }
    if normalized.as_os_str().is_empty() {
        return Err(ValidationError::ManifestPathInvalid);
    }
    Ok(normalized)
}

fn reject_link_components(root: &Path, parent: &Path) -> Result<(), ValidationError> {
    let relative = parent
        .strip_prefix(root)
        .map_err(|_| ValidationError::ManifestPathInvalid)?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Err(ValidationError::ManifestPathInvalid);
        };
        current.push(part);
        let metadata =
            fs::symlink_metadata(&current).map_err(|_| ValidationError::ManifestPathInvalid)?;
        if is_link_or_reparse(&metadata) || !metadata.is_dir() {
            return Err(ValidationError::ManifestPathInvalid);
        }
    }
    Ok(())
}

fn is_link_or_reparse(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }

    #[cfg(not(windows))]
    false
}

fn write_and_sync(file: &mut File, content: &[u8]) -> std::io::Result<()> {
    file.write_all(content)?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn atomic_manifest_export_rejects_traversal_and_requires_collision_confirmation() {
        let workspace = tempdir().expect("temporary workspace");
        let root = workspace.path().join("project");
        fs::create_dir_all(root.join("config")).expect("project directory");
        let filesystem = LocalManifestFilesystem;

        assert!(matches!(
            filesystem.write_atomic(
                root.to_str().expect("UTF-8 root"),
                "../outside.env",
                "SAFE=\n",
                ManifestCollisionChoice::Replace,
            ),
            Err(ValidationError::ManifestPathInvalid)
        ));

        filesystem
            .write_atomic(
                root.to_str().expect("UTF-8 root"),
                "config/.env.example",
                "SAFE=\n",
                ManifestCollisionChoice::Cancel,
            )
            .expect("new manifest");
        assert!(matches!(
            filesystem.write_atomic(
                root.to_str().expect("UTF-8 root"),
                "config/.env.example",
                "UPDATED=\n",
                ManifestCollisionChoice::Cancel,
            ),
            Err(ValidationError::ManifestConflict)
        ));
        filesystem
            .write_atomic(
                root.to_str().expect("UTF-8 root"),
                "config/.env.example",
                "UPDATED=\n",
                ManifestCollisionChoice::Replace,
            )
            .expect("confirmed replacement");
        assert_eq!(
            fs::read_to_string(root.join("config/.env.example")).expect("manifest content"),
            "UPDATED=\n"
        );
    }
}
