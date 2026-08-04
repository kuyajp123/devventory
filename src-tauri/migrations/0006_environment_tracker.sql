CREATE TABLE environments (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    normalized_name TEXT NOT NULL CHECK (length(normalized_name) BETWEEN 1 AND 80),
    description TEXT CHECK (description IS NULL OR length(description) <= 500),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE (project_id, normalized_name),
    UNIQUE (project_id, sort_order)
);

CREATE TABLE environment_sources (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    environment_id TEXT NOT NULL,
    relative_path TEXT NOT NULL CHECK (length(relative_path) BETWEEN 1 AND 1024),
    canonical_path_key TEXT NOT NULL CHECK (length(canonical_path_key) BETWEEN 1 AND 1024),
    priority INTEGER NOT NULL CHECK (priority >= 0),
    status TEXT NOT NULL DEFAULT 'ready'
        CHECK (status IN ('ready', 'missing', 'unreadable', 'parse_error')),
    parse_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (parse_status IN ('pending', 'parsed', 'failed')),
    size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
    modified_at_ms INTEGER,
    issue_count INTEGER NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
    last_parsed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE,
    UNIQUE (environment_id, canonical_path_key),
    UNIQUE (environment_id, priority)
);

CREATE TABLE environment_key_definitions (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 256),
    normalized_name TEXT NOT NULL CHECK (length(normalized_name) BETWEEN 1 AND 256),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE (project_id, normalized_name)
);

CREATE TABLE environment_key_occurrences (
    id TEXT PRIMARY KEY NOT NULL,
    key_definition_id TEXT NOT NULL,
    environment_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number > 0),
    commented INTEGER NOT NULL DEFAULT 0 CHECK (commented IN (0, 1)),
    duplicate INTEGER NOT NULL DEFAULT 0 CHECK (duplicate IN (0, 1)),
    parse_status TEXT NOT NULL DEFAULT 'parsed' CHECK (parse_status = 'parsed'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (key_definition_id) REFERENCES environment_key_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES environment_sources(id) ON DELETE CASCADE,
    UNIQUE (source_id, line_number, key_definition_id)
);

CREATE TABLE environment_parse_issues (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number > 0),
    issue_code TEXT NOT NULL CHECK (issue_code IN ('invalid_key', 'unsupported_syntax')),
    sanitized_message TEXT NOT NULL CHECK (length(sanitized_message) BETWEEN 1 AND 160),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (source_id) REFERENCES environment_sources(id) ON DELETE CASCADE
);

CREATE INDEX idx_environments_project_order
    ON environments(project_id, sort_order);
CREATE INDEX idx_environment_sources_project
    ON environment_sources(project_id, environment_id, priority);
CREATE INDEX idx_environment_sources_path
    ON environment_sources(project_id, canonical_path_key);
CREATE INDEX idx_environment_key_definitions_project_name
    ON environment_key_definitions(project_id, normalized_name);
CREATE INDEX idx_environment_key_occurrences_environment_key
    ON environment_key_occurrences(environment_id, key_definition_id);
CREATE INDEX idx_environment_key_occurrences_source
    ON environment_key_occurrences(source_id, line_number);
CREATE INDEX idx_environment_parse_issues_source
    ON environment_parse_issues(source_id, line_number);
