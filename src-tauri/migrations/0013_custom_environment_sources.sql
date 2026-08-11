CREATE TABLE custom_environment_sources (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) BETWEEN 1 AND 120),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id, environment_id)
        REFERENCES environments(project_id, id) ON DELETE CASCADE,
    UNIQUE(project_id, id, environment_id),
    UNIQUE(environment_id, normalized_name)
);

CREATE TABLE custom_environment_keys (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL,
    environment_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    key_definition_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 255),
    normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) BETWEEN 1 AND 255),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project_id, source_id, environment_id)
        REFERENCES custom_environment_sources(project_id, id, environment_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, key_definition_id)
        REFERENCES environment_key_definitions(project_id, id) ON DELETE CASCADE,
    UNIQUE(source_id, normalized_name)
);

CREATE INDEX custom_environment_sources_environment_sort_idx
    ON custom_environment_sources(environment_id, sort_order, id);
CREATE INDEX custom_environment_sources_project_idx
    ON custom_environment_sources(project_id, environment_id, id);
CREATE INDEX custom_environment_keys_source_idx
    ON custom_environment_keys(source_id, normalized_name, id);
CREATE INDEX custom_environment_keys_matrix_idx
    ON custom_environment_keys(project_id, key_definition_id, environment_id, source_id);
