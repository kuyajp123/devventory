CREATE TABLE scan_runs (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    watched_location_id TEXT REFERENCES watched_locations(id) ON DELETE SET NULL,
    scan_type TEXT NOT NULL CHECK (
        scan_type IN ('initial', 'startup', 'manual_project', 'manual_location', 'watcher')
    ),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed')),
    files_discovered INTEGER NOT NULL DEFAULT 0 CHECK (files_discovered >= 0),
    files_added INTEGER NOT NULL DEFAULT 0 CHECK (files_added >= 0),
    files_updated INTEGER NOT NULL DEFAULT 0 CHECK (files_updated >= 0),
    files_unchanged INTEGER NOT NULL DEFAULT 0 CHECK (files_unchanged >= 0),
    files_missing INTEGER NOT NULL DEFAULT 0 CHECK (files_missing >= 0),
    directories_visited INTEGER NOT NULL DEFAULT 0 CHECK (directories_visited >= 0),
    entries_excluded INTEGER NOT NULL DEFAULT 0 CHECK (entries_excluded >= 0),
    entries_unreadable INTEGER NOT NULL DEFAULT 0 CHECK (entries_unreadable >= 0),
    duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    error_summary TEXT CHECK (error_summary IS NULL OR length(error_summary) <= 240),
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE indexed_files (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    watched_location_id TEXT REFERENCES watched_locations(id) ON DELETE SET NULL,
    relative_path TEXT NOT NULL CHECK (length(trim(relative_path)) > 0),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    extension TEXT CHECK (extension IS NULL OR length(extension) BETWEEN 1 AND 32),
    mime_type TEXT CHECK (mime_type IS NULL OR length(mime_type) <= 160),
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    modified_at_ms INTEGER,
    category TEXT NOT NULL CHECK (
        category IN ('source', 'document', 'image', 'audio', 'video', 'archive', 'font', 'configuration', 'other')
    ),
    source_type TEXT NOT NULL CHECK (source_type IN ('discovered')),
    status TEXT NOT NULL CHECK (status IN ('active', 'missing')),
    first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_scan_id TEXT NOT NULL REFERENCES scan_runs(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, relative_path)
);

CREATE INDEX scan_runs_project_started_idx
    ON scan_runs(project_id, started_at DESC);
CREATE INDEX scan_runs_project_status_idx
    ON scan_runs(project_id, status);
CREATE INDEX indexed_files_project_status_path_idx
    ON indexed_files(project_id, status, relative_path);
CREATE INDEX indexed_files_project_category_idx
    ON indexed_files(project_id, category);
CREATE INDEX indexed_files_project_extension_idx
    ON indexed_files(project_id, extension);
CREATE INDEX indexed_files_project_name_idx
    ON indexed_files(project_id, name COLLATE NOCASE);
CREATE INDEX indexed_files_watched_location_idx
    ON indexed_files(watched_location_id);
