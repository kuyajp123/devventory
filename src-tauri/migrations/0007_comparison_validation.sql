ALTER TABLE environment_key_occurrences ADD COLUMN observed_name TEXT;

UPDATE environment_key_occurrences
SET observed_name = (
    SELECT name
    FROM environment_key_definitions
    WHERE environment_key_definitions.id = environment_key_occurrences.key_definition_id
)
WHERE observed_name IS NULL;

CREATE TABLE environment_key_rules (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL CHECK (length(trim(key_name)) BETWEEN 1 AND 255),
    normalized_key TEXT NOT NULL CHECK (length(trim(normalized_key)) BETWEEN 1 AND 255),
    rule_type TEXT NOT NULL CHECK (rule_type IN ('required', 'optional', 'forbidden')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    description TEXT CHECK (description IS NULL OR length(description) <= 2000),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, normalized_key, rule_type),
    UNIQUE(project_id, id)
);

CREATE TABLE environment_key_rule_targets (
    project_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    environment_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY(rule_id, environment_id),
    FOREIGN KEY (project_id, rule_id)
        REFERENCES environment_key_rules(project_id, id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, environment_id)
        REFERENCES environments(project_id, id) ON DELETE CASCADE
);

CREATE TABLE validation_issues (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id TEXT REFERENCES environments(id) ON DELETE CASCADE,
    key_definition_id TEXT REFERENCES environment_key_definitions(id) ON DELETE SET NULL,
    rule_id TEXT REFERENCES environment_key_rules(id) ON DELETE SET NULL,
    source_id TEXT REFERENCES environment_sources(id) ON DELETE SET NULL,
    fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
    key_name TEXT NOT NULL CHECK (length(trim(key_name)) BETWEEN 1 AND 255),
    normalized_key TEXT NOT NULL CHECK (length(normalized_key) <= 255),
    issue_type TEXT NOT NULL CHECK (issue_type IN (
        'required_missing',
        'required_commented',
        'forbidden_present',
        'unexpected_present',
        'duplicate',
        'case_mismatch',
        'invalid_name',
        'source_unreadable',
        'parse_issue'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ignored', 'resolved')),
    message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 500),
    source_path TEXT CHECK (source_path IS NULL OR length(source_path) <= 1024),
    line_number INTEGER CHECK (line_number IS NULL OR line_number >= 1),
    observed_name TEXT CHECK (observed_name IS NULL OR length(observed_name) <= 255),
    last_seen_run_id TEXT NOT NULL CHECK (length(last_seen_run_id) = 36),
    first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(project_id, fingerprint)
);

CREATE TABLE project_validation_state (
    project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    health TEXT NOT NULL CHECK (health IN ('healthy', 'warning', 'error', 'unknown')),
    last_successful_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX environment_key_rules_project_sort_idx
    ON environment_key_rules(project_id, sort_order, id);
CREATE INDEX environment_key_rules_project_key_idx
    ON environment_key_rules(project_id, normalized_key, enabled, rule_type);
CREATE INDEX environment_key_rule_targets_environment_idx
    ON environment_key_rule_targets(project_id, environment_id, rule_id);
CREATE INDEX validation_issues_project_status_severity_idx
    ON validation_issues(project_id, status, severity, updated_at DESC, id);
CREATE INDEX validation_issues_project_environment_idx
    ON validation_issues(project_id, environment_id, status, id);
CREATE INDEX validation_issues_project_key_idx
    ON validation_issues(project_id, normalized_key, status, id);
CREATE INDEX validation_issues_project_type_idx
    ON validation_issues(project_id, issue_type, status, id);
CREATE INDEX validation_issues_rule_idx
    ON validation_issues(rule_id, status, id);
