CREATE TABLE search_history (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL CHECK (length(query_text) <= 256),
    request_json TEXT NOT NULL CHECK (length(request_json) BETWEEN 2 AND 12000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX search_history_recent_idx
    ON search_history(created_at DESC, id DESC);
CREATE INDEX search_history_project_recent_idx
    ON search_history(project_id, created_at DESC, id DESC);
CREATE INDEX projects_name_nocase_idx
    ON projects(name COLLATE NOCASE, id);
CREATE INDEX indexed_files_project_path_nocase_idx
    ON indexed_files(project_id, relative_path COLLATE NOCASE, id);
CREATE INDEX indexed_files_project_modified_idx
    ON indexed_files(project_id, modified_at_ms DESC, id);
