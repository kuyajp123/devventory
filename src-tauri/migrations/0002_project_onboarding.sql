CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    description TEXT CHECK (description IS NULL OR length(description) <= 2000),
    project_type TEXT NOT NULL CHECK (
        project_type IN ('web', 'desktop', 'mobile', 'backend', 'library', 'monorepo', 'other')
    ),
    root_path TEXT NOT NULL CHECK (length(trim(root_path)) > 0),
    root_path_key TEXT NOT NULL UNIQUE CHECK (length(trim(root_path_key)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE watched_locations (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL CHECK (length(trim(relative_path)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, relative_path)
);

CREATE TABLE project_exclusions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    relative_pattern TEXT NOT NULL CHECK (length(trim(relative_pattern)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, relative_pattern)
);

CREATE TABLE initial_scan_summaries (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    files_discovered INTEGER NOT NULL CHECK (files_discovered >= 0),
    directories_visited INTEGER NOT NULL CHECK (directories_visited >= 0),
    entries_excluded INTEGER NOT NULL CHECK (entries_excluded >= 0),
    entries_unreadable INTEGER NOT NULL CHECK (entries_unreadable >= 0),
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX watched_locations_project_id_idx ON watched_locations(project_id);
CREATE INDEX project_exclusions_project_id_idx ON project_exclusions(project_id);
