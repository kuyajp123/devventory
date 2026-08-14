CREATE TABLE credential_sources (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    definition_key TEXT CHECK (
        definition_key IS NULL OR length(trim(definition_key)) BETWEEN 1 AND 64
    ),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) BETWEEN 1 AND 120),
    description TEXT CHECK (description IS NULL OR length(description) <= 2000),
    icon_file_name TEXT CHECK (
        icon_file_name IS NULL OR (
            length(icon_file_name) BETWEEN 1 AND 255
            AND instr(icon_file_name, '/') = 0
            AND instr(icon_file_name, '\\') = 0
        )
    ),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE credential_source_projects (
    source_id TEXT NOT NULL REFERENCES credential_sources(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (source_id, project_id)
);

CREATE TABLE credentials (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    source_id TEXT NOT NULL REFERENCES credential_sources(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL CHECK (length(trim(key_name)) BETWEEN 1 AND 255),
    normalized_key_name TEXT NOT NULL CHECK (
        length(trim(normalized_key_name)) BETWEEN 1 AND 255
    ),
    notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
    secret_reference TEXT UNIQUE CHECK (
        secret_reference IS NULL OR length(secret_reference) = 36
    ),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (source_id, normalized_key_name)
);

CREATE TABLE credential_project_links (
    credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_definition_id TEXT NOT NULL,
    PRIMARY KEY (credential_id, project_id),
    FOREIGN KEY (project_id, key_definition_id)
        REFERENCES environment_key_definitions(project_id, id) ON DELETE CASCADE
);

CREATE TABLE credential_environment_links (
    credential_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    environment_id TEXT NOT NULL,
    PRIMARY KEY (credential_id, project_id, environment_id),
    FOREIGN KEY (credential_id, project_id)
        REFERENCES credential_project_links(credential_id, project_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, environment_id)
        REFERENCES environments(project_id, id) ON DELETE CASCADE
);

CREATE INDEX credential_sources_definition_idx
    ON credential_sources(definition_key, sort_order, created_at, id);
CREATE INDEX credential_source_projects_project_idx
    ON credential_source_projects(project_id, source_id);
CREATE INDEX credentials_source_idx
    ON credentials(source_id, normalized_key_name, id);
CREATE INDEX credential_project_links_matrix_idx
    ON credential_project_links(project_id, key_definition_id, credential_id);
CREATE INDEX credential_environment_links_matrix_idx
    ON credential_environment_links(project_id, environment_id, credential_id);

-- Preserve the metadata-only Custom Sources created before Credential Vault.
-- Their IDs stay stable so Environment Tracker selections and audit context do not drift.
INSERT INTO credential_sources (
    id, definition_key, name, normalized_name, description, icon_file_name,
    sort_order, created_at, updated_at
)
SELECT id, NULL, name, normalized_name, NULL, NULL,
       sort_order, created_at, updated_at
FROM custom_environment_sources;

INSERT OR IGNORE INTO credential_source_projects (source_id, project_id)
SELECT id, project_id FROM custom_environment_sources;

INSERT INTO credentials (
    id, source_id, key_name, normalized_key_name, notes, secret_reference,
    created_at, updated_at
)
SELECT id, source_id, name, normalized_name, NULL, NULL, created_at, updated_at
FROM custom_environment_keys;

INSERT INTO credential_project_links (credential_id, project_id, key_definition_id)
SELECT id, project_id, key_definition_id FROM custom_environment_keys;

INSERT INTO credential_environment_links (credential_id, project_id, environment_id)
SELECT id, project_id, environment_id FROM custom_environment_keys;
