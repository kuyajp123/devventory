use std::collections::HashSet;
use std::fs::{self, FileType};
use std::path::{Component, Path};
use std::time::{Instant, UNIX_EPOCH};

use tokio::sync::mpsc;

use crate::features::projects::{is_project_path_excluded, ResolvedProjectScanTarget};

use super::categorization;
use super::model::{ScanTraversalSummary, ScannedFile};

pub(super) const SCAN_BATCH_SIZE: usize = 250;
const MAX_SCAN_ENTRIES: u64 = 1_000_000;
const MAX_JAVASCRIPT_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Debug)]
pub(super) enum ScanMessage {
    Batch(Vec<ScannedFile>),
    Finished(ScanTraversalSummary),
}

#[derive(Debug, Clone, Copy, Default)]
pub(super) struct LocalFileScanner;

impl LocalFileScanner {
    pub(super) fn scan(
        &self,
        target: ResolvedProjectScanTarget,
        sender: mpsc::Sender<ScanMessage>,
    ) {
        let started_at = Instant::now();
        let mut summary = ScanTraversalSummary {
            completed: true,
            ..ScanTraversalSummary::default()
        };
        let mut pending = target
            .watched_locations
            .iter()
            .map(|location| (location.id, location.absolute_path.clone()))
            .collect::<Vec<_>>();
        pending.sort_by(|left, right| {
            left.1
                .components()
                .count()
                .cmp(&right.1.components().count())
                .then_with(|| left.1.cmp(&right.1))
        });

        let mut batch = Vec::with_capacity(SCAN_BATCH_SIZE);
        let mut visited = HashSet::new();
        let mut processed_entries = 0_u64;

        'scan: while let Some((watched_location_id, directory)) = pending.pop() {
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
                let Some(relative_path) = portable_relative_path(&target.root_path, &path) else {
                    summary.entries_unreadable += 1;
                    summary.completed = false;
                    continue;
                };
                let file_type = match entry.file_type() {
                    Ok(file_type) => file_type,
                    Err(_) => {
                        summary.entries_unreadable += 1;
                        summary.completed = false;
                        continue;
                    }
                };
                if is_project_path_excluded(&relative_path, file_type.is_dir(), &target.exclusions)
                {
                    summary.entries_excluded += 1;
                    continue;
                }
                match is_link_or_reparse_point(&path, &file_type) {
                    Ok(true) => {
                        summary.entries_excluded += 1;
                        continue;
                    }
                    Ok(false) => {}
                    Err(_) => {
                        summary.entries_unreadable += 1;
                        summary.completed = false;
                        continue;
                    }
                }

                if file_type.is_dir() {
                    pending.push((watched_location_id, path));
                    continue;
                }
                if !file_type.is_file() {
                    summary.entries_excluded += 1;
                    continue;
                }

                let metadata = match entry.metadata() {
                    Ok(metadata) if metadata.len() <= MAX_JAVASCRIPT_SAFE_INTEGER => metadata,
                    Ok(_) | Err(_) => {
                        summary.entries_unreadable += 1;
                        summary.completed = false;
                        continue;
                    }
                };
                let Some(name) = entry.file_name().to_str().map(ToOwned::to_owned) else {
                    summary.entries_unreadable += 1;
                    summary.completed = false;
                    continue;
                };

                batch.push(ScannedFile {
                    watched_location_id,
                    relative_path,
                    name,
                    extension: categorization::extension(&path),
                    mime_type: categorization::mime_type(&path),
                    size_bytes: metadata.len(),
                    modified_at_ms: modified_at_ms(&metadata),
                    category: categorization::category(&path),
                });
                summary.files_discovered += 1;

                if batch.len() == SCAN_BATCH_SIZE
                    && sender
                        .blocking_send(ScanMessage::Batch(std::mem::take(&mut batch)))
                        .is_err()
                {
                    return;
                }
            }
        }

        if !batch.is_empty() && sender.blocking_send(ScanMessage::Batch(batch)).is_err() {
            return;
        }
        summary.duration_ms = u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX);
        let _ = sender.blocking_send(ScanMessage::Finished(summary));
    }
}

fn portable_relative_path(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root)
        .ok()?
        .components()
        .map(|component| match component {
            Component::Normal(part) => part.to_str().map(ToOwned::to_owned),
            _ => None,
        })
        .collect::<Option<Vec<_>>>()
        .map(|parts| parts.join("/"))
        .filter(|path| !path.is_empty())
}

fn modified_at_ms(metadata: &fs::Metadata) -> Option<i64> {
    metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| i64::try_from(duration.as_millis()).ok())
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

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;
    use tokio::sync::mpsc;
    use uuid::Uuid;

    use crate::features::projects::{ResolvedProjectScanTarget, ResolvedWatchedLocation};

    use super::{LocalFileScanner, ScanMessage, SCAN_BATCH_SIZE};

    #[tokio::test]
    async fn scans_metadata_in_bounded_batches_and_applies_exclusions() {
        let workspace = tempdir().expect("temporary workspace");
        let root = workspace.path().join("project");
        fs::create_dir_all(root.join("src")).expect("source directory");
        fs::create_dir_all(root.join("node_modules/pkg")).expect("excluded directory");
        fs::write(root.join("src/main.ts"), "export {};").expect("source file");
        fs::write(root.join("README.md"), "# Project").expect("document file");
        fs::write(root.join("node_modules/pkg/index.js"), "ignored").expect("excluded file");
        let location_id = Uuid::new_v4();
        let target = ResolvedProjectScanTarget {
            id: Uuid::new_v4(),
            root_path: root.clone(),
            watched_locations: vec![ResolvedWatchedLocation {
                id: location_id,
                relative_path: ".".to_owned(),
                absolute_path: root,
            }],
            exclusions: vec!["node_modules/".to_owned()],
        };
        let (sender, mut receiver) = mpsc::channel(2);

        std::thread::spawn(move || LocalFileScanner.scan(target, sender));

        let mut files = Vec::new();
        let mut final_summary = None;
        while let Some(message) = receiver.recv().await {
            match message {
                ScanMessage::Batch(batch) => {
                    assert!(batch.len() <= SCAN_BATCH_SIZE);
                    files.extend(batch);
                }
                ScanMessage::Finished(summary) => {
                    final_summary = Some(summary);
                    break;
                }
            }
        }

        files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].relative_path, "README.md");
        assert_eq!(files[1].relative_path, "src/main.ts");
        assert_eq!(files[1].watched_location_id, location_id);
        assert_eq!(files[1].extension.as_deref(), Some("ts"));
        assert!(files[1].size_bytes > 0);
        let summary = final_summary.expect("scan summary");
        assert_eq!(summary.files_discovered, 2);
        assert_eq!(summary.entries_excluded, 1);
        assert!(summary.completed);
    }

    #[tokio::test]
    async fn handles_empty_and_reasonably_deep_projects() {
        let workspace = tempdir().expect("temporary workspace");
        let empty_root = workspace.path().join("empty");
        fs::create_dir_all(&empty_root).expect("empty root");
        let empty_summary = collect_scan(scan_target(empty_root)).await.1;
        assert_eq!(empty_summary.files_discovered, 0);
        assert_eq!(empty_summary.directories_visited, 1);
        assert!(empty_summary.completed);

        let nested_root = workspace.path().join("nested");
        let mut directory = nested_root.clone();
        for index in 0..30 {
            directory = directory.join(format!("level-{index}"));
            fs::create_dir_all(&directory).expect("nested directory");
            fs::write(directory.join(format!("file-{index}.txt")), "metadata only")
                .expect("nested file");
        }
        let (files, nested_summary) = collect_scan(scan_target(nested_root)).await;
        assert_eq!(files.len(), 30);
        assert_eq!(nested_summary.files_discovered, 30);
        assert!(nested_summary.completed);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn does_not_follow_symbolic_links() {
        use std::os::unix::fs::symlink;

        let workspace = tempdir().expect("temporary workspace");
        let root = workspace.path().join("project");
        let outside = workspace.path().join("outside");
        fs::create_dir_all(&root).expect("root");
        fs::create_dir_all(&outside).expect("outside");
        fs::write(outside.join("secret.txt"), "not scanned").expect("outside file");
        symlink(&outside, root.join("linked")).expect("symlink");
        let target = ResolvedProjectScanTarget {
            id: Uuid::new_v4(),
            root_path: root.clone(),
            watched_locations: vec![ResolvedWatchedLocation {
                id: Uuid::new_v4(),
                relative_path: ".".to_owned(),
                absolute_path: root,
            }],
            exclusions: vec![],
        };
        let (sender, mut receiver) = mpsc::channel(2);
        std::thread::spawn(move || LocalFileScanner.scan(target, sender));

        let mut discovered = 0;
        while let Some(message) = receiver.recv().await {
            match message {
                ScanMessage::Batch(batch) => discovered += batch.len(),
                ScanMessage::Finished(summary) => {
                    assert_eq!(summary.entries_excluded, 1);
                    break;
                }
            }
        }
        assert_eq!(discovered, 0);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn records_unrepresentable_entries_as_unreadable_without_stopping() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;

        let workspace = tempdir().expect("temporary workspace");
        let root = workspace.path().join("project");
        fs::create_dir_all(&root).expect("root");
        fs::write(root.join("safe.txt"), "safe").expect("safe file");
        fs::write(
            root.join(OsString::from_vec(vec![0xff, b'.', b't', b'x', b't'])),
            "opaque",
        )
        .expect("non UTF-8 file");

        let (files, summary) = collect_scan(scan_target(root)).await;
        assert_eq!(files.len(), 1);
        assert_eq!(summary.entries_unreadable, 1);
        assert!(!summary.completed);
    }

    fn scan_target(root: std::path::PathBuf) -> ResolvedProjectScanTarget {
        ResolvedProjectScanTarget {
            id: Uuid::new_v4(),
            root_path: root.clone(),
            watched_locations: vec![ResolvedWatchedLocation {
                id: Uuid::new_v4(),
                relative_path: ".".to_owned(),
                absolute_path: root,
            }],
            exclusions: vec![],
        }
    }

    async fn collect_scan(
        target: ResolvedProjectScanTarget,
    ) -> (Vec<super::ScannedFile>, super::ScanTraversalSummary) {
        let (sender, mut receiver) = mpsc::channel(2);
        std::thread::spawn(move || LocalFileScanner.scan(target, sender));
        let mut files = Vec::new();
        while let Some(message) = receiver.recv().await {
            match message {
                ScanMessage::Batch(batch) => files.extend(batch),
                ScanMessage::Finished(summary) => return (files, summary),
            }
        }
        panic!("scan finished message");
    }
}
