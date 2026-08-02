use std::collections::{HashMap, HashSet};
use std::fmt;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::event::ModifyKind;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::time::{sleep_until, Instant};
use uuid::Uuid;

use crate::features::projects::ResolvedProjectScanTarget;

use super::error::FileInventoryError;
use super::model::{ScanRun, ScanType};
use super::service::FileInventoryService;

pub(crate) const INVENTORY_CHANGED_EVENT: &str = "inventory://changed";
const WATCH_CHANNEL_CAPACITY: usize = 512;
const WATCH_DEBOUNCE: Duration = Duration::from_millis(350);

type NativeEventHandler = Box<dyn FnMut(notify::Result<Event>) + Send>;

trait ProjectWatcher: Send {
    fn watch_recursive(&mut self, path: &std::path::Path) -> notify::Result<()>;
}

trait WatcherFactory: Send + Sync {
    fn create(&self, handler: NativeEventHandler) -> notify::Result<Box<dyn ProjectWatcher>>;
}

#[derive(Debug, Default)]
struct NotifyWatcherFactory;

impl WatcherFactory for NotifyWatcherFactory {
    fn create(&self, handler: NativeEventHandler) -> notify::Result<Box<dyn ProjectWatcher>> {
        notify::recommended_watcher(handler)
            .map(|watcher| Box::new(NotifyProjectWatcher(watcher)) as Box<dyn ProjectWatcher>)
    }
}

struct NotifyProjectWatcher(RecommendedWatcher);

impl ProjectWatcher for NotifyProjectWatcher {
    fn watch_recursive(&mut self, path: &std::path::Path) -> notify::Result<()> {
        self.0.watch(path, RecursiveMode::Recursive)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum LogicalEventKind {
    Create,
    Modify,
    Remove,
    Rename,
    Reconcile,
}

#[derive(Debug)]
struct WatchEvent {
    project_id: Uuid,
    kind: LogicalEventKind,
    paths: Vec<PathBuf>,
}

#[derive(Debug, Default)]
struct EventCoalescer {
    changes: HashMap<(Uuid, PathBuf), LogicalEventKind>,
}

impl EventCoalescer {
    fn push(&mut self, event: WatchEvent) {
        let paths = if event.paths.is_empty() {
            vec![PathBuf::new()]
        } else {
            event.paths
        };
        for path in paths {
            self.changes
                .entry((event.project_id, path))
                .and_modify(|existing| *existing = merge_kind(*existing, event.kind))
                .or_insert(event.kind);
        }
    }

    fn project_ids(&self) -> Vec<Uuid> {
        let mut ids = self
            .changes
            .keys()
            .map(|(project_id, _)| *project_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        ids.sort_unstable();
        ids
    }

    fn change_count(&self) -> usize {
        self.changes.len()
    }
}

fn merge_kind(existing: LogicalEventKind, incoming: LogicalEventKind) -> LogicalEventKind {
    use LogicalEventKind::{Create, Modify, Reconcile, Remove, Rename};

    match (existing, incoming) {
        (Reconcile, _) | (_, Reconcile) => Reconcile,
        (Rename, _) | (_, Rename) => Rename,
        (Create, Modify) | (Modify, Create) | (Create, Create) => Create,
        (Remove, Create) | (Create, Remove) => Reconcile,
        (Remove, _) | (_, Remove) => Remove,
        _ => Modify,
    }
}

pub(crate) struct InventoryRuntime {
    sender: mpsc::Sender<WatchEvent>,
    receiver: tokio::sync::Mutex<Option<mpsc::Receiver<WatchEvent>>>,
    overflowed_projects: Arc<Mutex<HashSet<Uuid>>>,
    watcher_factory: Arc<dyn WatcherFactory>,
    watchers: Mutex<HashMap<Uuid, Box<dyn ProjectWatcher>>>,
    worker: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl fmt::Debug for InventoryRuntime {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("InventoryRuntime")
            .field("channel_capacity", &WATCH_CHANNEL_CAPACITY)
            .finish_non_exhaustive()
    }
}

impl InventoryRuntime {
    pub(crate) fn new() -> Self {
        let (sender, receiver) = mpsc::channel(WATCH_CHANNEL_CAPACITY);
        Self {
            sender,
            receiver: tokio::sync::Mutex::new(Some(receiver)),
            overflowed_projects: Arc::new(Mutex::new(HashSet::new())),
            watcher_factory: Arc::new(NotifyWatcherFactory),
            watchers: Mutex::new(HashMap::new()),
            worker: Mutex::new(None),
        }
    }

    #[cfg(test)]
    fn with_factory(watcher_factory: Arc<dyn WatcherFactory>) -> Self {
        let mut runtime = Self::new();
        runtime.watcher_factory = watcher_factory;
        runtime
    }

    pub(crate) async fn start(
        &self,
        app: AppHandle,
        service: FileInventoryService,
    ) -> Result<(), FileInventoryError> {
        let mut receiver_guard = self.receiver.lock().await;
        let mut receiver = receiver_guard
            .take()
            .ok_or(FileInventoryError::RuntimeUnavailable)?;
        drop(receiver_guard);

        let overflowed_projects = Arc::clone(&self.overflowed_projects);
        let worker_app = app.clone();
        let worker_service = service.clone();
        let worker = tauri::async_runtime::spawn(async move {
            while let Some(first) = receiver.recv().await {
                let mut coalescer = EventCoalescer::default();
                coalescer.push(first);
                let deadline = Instant::now() + WATCH_DEBOUNCE;

                loop {
                    tokio::select! {
                        event = receiver.recv() => match event {
                            Some(event) => coalescer.push(event),
                            None => break,
                        },
                        () = sleep_until(deadline) => break,
                    }
                }

                if let Ok(mut overflowed) = overflowed_projects.lock() {
                    for project_id in overflowed.drain() {
                        coalescer.push(WatchEvent {
                            project_id,
                            kind: LogicalEventKind::Reconcile,
                            paths: Vec::new(),
                        });
                    }
                }
                let change_count = coalescer.change_count();

                for project_id in coalescer.project_ids() {
                    match worker_service
                        .reconcile_project(project_id, ScanType::Watcher)
                        .await
                    {
                        Ok(scan) => emit_inventory_changed(&worker_app, &scan),
                        Err(error) => tracing::warn!(
                            project_id = %project_id,
                            error = %error,
                            "watcher reconciliation failed"
                        ),
                    }
                }

                tracing::debug!(change_count, "coalesced filesystem watcher changes");
            }
        });
        let mut worker_guard = self
            .worker
            .lock()
            .map_err(|_| FileInventoryError::RuntimeUnavailable)?;
        *worker_guard = Some(worker);
        drop(worker_guard);

        let startup_app = app;
        tauri::async_runtime::spawn(async move {
            for scan in service.reconcile_all(ScanType::Startup).await {
                emit_inventory_changed(&startup_app, &scan);
            }
        });
        Ok(())
    }

    pub(crate) fn replace_watchers(
        &self,
        targets: Vec<ResolvedProjectScanTarget>,
    ) -> Result<(), FileInventoryError> {
        let mut replacements = HashMap::with_capacity(targets.len());
        for target in targets {
            let project_id = target.id;
            let sender = self.sender.clone();
            let overflowed_projects = Arc::clone(&self.overflowed_projects);
            let handler: NativeEventHandler = Box::new(move |result: notify::Result<Event>| {
                match result {
                    Ok(event) => {
                        let Some(kind) = logical_kind(&event.kind) else {
                            return;
                        };
                        let message = WatchEvent {
                            project_id,
                            kind,
                            paths: event.paths,
                        };
                        if matches!(
                            sender.try_send(message),
                            Err(mpsc::error::TrySendError::Full(_))
                        ) {
                            if let Ok(mut overflowed) = overflowed_projects.lock() {
                                overflowed.insert(project_id);
                            }
                        }
                    }
                    Err(error) => {
                        tracing::warn!(project_id = %project_id, error = %error, "native watcher reported an error");
                        let message = WatchEvent {
                            project_id,
                            kind: LogicalEventKind::Reconcile,
                            paths: Vec::new(),
                        };
                        if matches!(
                            sender.try_send(message),
                            Err(mpsc::error::TrySendError::Full(_))
                        ) {
                            if let Ok(mut overflowed) = overflowed_projects.lock() {
                                overflowed.insert(project_id);
                            }
                        }
                    }
                }
            });
            let mut watcher = match self.watcher_factory.create(handler) {
                Ok(watcher) => watcher,
                Err(error) => {
                    tracing::warn!(project_id = %project_id, error = %error, "could not create native project watcher");
                    continue;
                }
            };

            let mut candidate_paths = target
                .watched_locations
                .into_iter()
                .map(|location| location.absolute_path)
                .collect::<Vec<_>>();
            candidate_paths.sort_by_key(|path| path.components().count());
            let mut watched_paths = Vec::<PathBuf>::new();
            let mut watcher_failed = false;
            for path in candidate_paths {
                if watched_paths
                    .iter()
                    .any(|existing| path.starts_with(existing))
                {
                    continue;
                }
                if let Err(error) = watcher.watch_recursive(&path) {
                    tracing::warn!(project_id = %project_id, error = %error, "could not watch a project location");
                    watcher_failed = true;
                    break;
                }
                watched_paths.push(path);
            }
            if watcher_failed {
                continue;
            }
            replacements.insert(project_id, watcher);
        }

        let mut watchers = self
            .watchers
            .lock()
            .map_err(|_| FileInventoryError::RuntimeUnavailable)?;
        *watchers = replacements;
        Ok(())
    }
}

impl Drop for InventoryRuntime {
    fn drop(&mut self) {
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(worker) = worker.take() {
                worker.abort();
            }
        }
        if let Ok(mut watchers) = self.watchers.lock() {
            watchers.clear();
        }
    }
}

fn logical_kind(kind: &EventKind) -> Option<LogicalEventKind> {
    match kind {
        EventKind::Access(_) => None,
        EventKind::Create(_) => Some(LogicalEventKind::Create),
        EventKind::Modify(ModifyKind::Name(_)) => Some(LogicalEventKind::Rename),
        EventKind::Modify(_) => Some(LogicalEventKind::Modify),
        EventKind::Remove(_) => Some(LogicalEventKind::Remove),
        EventKind::Any | EventKind::Other => Some(LogicalEventKind::Reconcile),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InventoryChangedPayload {
    project_id: String,
    scan_id: String,
    status: super::model::ScanStatus,
}

fn emit_inventory_changed(app: &AppHandle, scan: &ScanRun) {
    let payload = InventoryChangedPayload {
        project_id: scan.project_id.to_string(),
        scan_id: scan.id.to_string(),
        status: scan.status,
    };
    if let Err(error) = app.emit(INVENTORY_CHANGED_EVENT, payload) {
        tracing::warn!(
            project_id = %scan.project_id,
            scan_id = %scan.id,
            error = %error,
            "could not notify the frontend about inventory changes"
        );
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};

    use notify::event::{CreateKind, ModifyKind, RenameMode};
    use notify::EventKind;
    use uuid::Uuid;

    use crate::features::projects::{ResolvedProjectScanTarget, ResolvedWatchedLocation};

    use super::{
        logical_kind, EventCoalescer, InventoryRuntime, LogicalEventKind, NativeEventHandler,
        ProjectWatcher, WatchEvent, WatcherFactory,
    };

    #[test]
    fn maps_native_create_modify_remove_and_rename_events() {
        assert_eq!(
            logical_kind(&EventKind::Create(CreateKind::File)),
            Some(LogicalEventKind::Create)
        );
        assert_eq!(
            logical_kind(&EventKind::Modify(ModifyKind::Any)),
            Some(LogicalEventKind::Modify)
        );
        assert_eq!(
            logical_kind(&EventKind::Modify(ModifyKind::Name(RenameMode::Both))),
            Some(LogicalEventKind::Rename)
        );
        assert_eq!(
            logical_kind(&EventKind::Remove(notify::event::RemoveKind::File)),
            Some(LogicalEventKind::Remove)
        );
    }

    #[test]
    fn coalesces_event_storms_to_one_project_reconciliation() {
        let project_id = Uuid::new_v4();
        let path = PathBuf::from("src/main.ts");
        let mut coalescer = EventCoalescer::default();
        coalescer.push(WatchEvent {
            project_id,
            kind: LogicalEventKind::Create,
            paths: vec![path.clone()],
        });
        coalescer.push(WatchEvent {
            project_id,
            kind: LogicalEventKind::Modify,
            paths: vec![path],
        });
        coalescer.push(WatchEvent {
            project_id,
            kind: LogicalEventKind::Rename,
            paths: vec![PathBuf::from("src/old.ts"), PathBuf::from("src/new.ts")],
        });

        assert_eq!(coalescer.project_ids(), [project_id]);
        assert_eq!(coalescer.change_count(), 3);
    }

    #[test]
    fn watcher_adapter_deduplicates_nested_locations() {
        let root = PathBuf::from("C:/workspace/project");
        let recorded = Arc::new(Mutex::new(Vec::new()));
        let runtime = InventoryRuntime::with_factory(Arc::new(RecordingWatcherFactory {
            recorded: Arc::clone(&recorded),
        }));

        runtime
            .replace_watchers(vec![ResolvedProjectScanTarget {
                id: Uuid::new_v4(),
                root_path: root.clone(),
                watched_locations: vec![
                    ResolvedWatchedLocation {
                        id: Uuid::new_v4(),
                        relative_path: ".".to_owned(),
                        absolute_path: root.clone(),
                    },
                    ResolvedWatchedLocation {
                        id: Uuid::new_v4(),
                        relative_path: "src".to_owned(),
                        absolute_path: root.join("src"),
                    },
                ],
                exclusions: vec![],
            }])
            .expect("watcher registration");

        assert_eq!(*recorded.lock().expect("recorded paths"), [root]);
    }

    struct RecordingWatcherFactory {
        recorded: Arc<Mutex<Vec<PathBuf>>>,
    }

    impl WatcherFactory for RecordingWatcherFactory {
        fn create(&self, _handler: NativeEventHandler) -> notify::Result<Box<dyn ProjectWatcher>> {
            Ok(Box::new(RecordingWatcher {
                recorded: Arc::clone(&self.recorded),
            }))
        }
    }

    struct RecordingWatcher {
        recorded: Arc<Mutex<Vec<PathBuf>>>,
    }

    impl ProjectWatcher for RecordingWatcher {
        fn watch_recursive(&mut self, path: &std::path::Path) -> notify::Result<()> {
            self.recorded
                .lock()
                .expect("recorded paths")
                .push(path.to_path_buf());
            Ok(())
        }
    }
}
