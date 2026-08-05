CREATE TABLE environments (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) BETWEEN 1 AND 120),
    description TEXT CHECK (description IS NULL OR length(description) <= 2000),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, normalized_name),
    UNIQUE(project_id, id)
);

CREATE TABLE environment_sources (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id TEXT NOT NULL,
    relative_path TEXT NOT NULL CHECK (length(trim(relative_path)) BETWEEN 1 AND 1024),
    normalized_path TEXT NOT NULL CHECK (length(trim(normalized_path)) BETWEEN 1 AND 1024),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    parse_status TEXT NOT NULL DEFAULT 'not_parsed' CHECK (
        parse_status IN ('not_parsed', 'parsed', 'missing', 'unreadable', 'parse_issue', 'unsupported_encoding')
    ),
    last_observed_size_bytes INTEGER CHECK (last_observed_size_bytes IS NULL OR last_observed_size_bytes >= 0),
    last_observed_modified_at_ms INTEGER,
    last_parsed_at TEXT,
    last_successful_parse_at TEXT,
    last_issue_line INTEGER CHECK (last_issue_line IS NULL OR last_issue_line >= 1),
    last_issue_code TEXT CHECK (last_issue_code IS NULL OR length(last_issue_code) <= 64),
    last_issue_message TEXT CHECK (last_issue_message IS NULL OR length(last_issue_message) <= 240),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id, environment_id)
        REFERENCES environments(project_id, id) ON DELETE CASCADE,
    UNIQUE(project_id, id, environment_id),
    UNIQUE(environment_id, normalized_path)
);

CREATE TABLE environment_key_definitions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 255),
    normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) BETWEEN 1 AND 255),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, normalized_name),
    UNIQUE(project_id, id)
);

CREATE TABLE environment_key_occurrences (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL,
    environment_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    key_definition_id TEXT NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number >= 1),
    is_commented INTEGER NOT NULL CHECK (is_commented IN (0, 1)),
    is_duplicate INTEGER NOT NULL DEFAULT 0 CHECK (is_duplicate IN (0, 1)),
    parse_status TEXT NOT NULL DEFAULT 'recognized' CHECK (parse_status = 'recognized'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id, environment_id)
        REFERENCES environments(project_id, id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, source_id, environment_id)
        REFERENCES environment_sources(project_id, id, environment_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, key_definition_id)
        REFERENCES environment_key_definitions(project_id, id) ON DELETE CASCADE,
    UNIQUE(source_id, key_definition_id, line_number)
);

CREATE INDEX environments_project_sort_idx
    ON environments(project_id, sort_order, id);
CREATE INDEX environment_sources_environment_sort_idx
    ON environment_sources(environment_id, sort_order, id);
CREATE INDEX environment_sources_project_path_idx
    ON environment_sources(project_id, normalized_path);
CREATE INDEX environment_key_definitions_project_name_idx
    ON environment_key_definitions(project_id, normalized_name, id);
CREATE INDEX environment_key_occurrences_matrix_idx
    ON environment_key_occurrences(project_id, key_definition_id, environment_id, is_commented, is_duplicate);
CREATE INDEX environment_key_occurrences_source_idx
    ON environment_key_occurrences(source_id, line_number);
