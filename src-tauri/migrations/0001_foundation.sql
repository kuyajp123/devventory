CREATE TABLE application_settings (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    setting_key TEXT NOT NULL UNIQUE CHECK (length(trim(setting_key)) > 0),
    setting_value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE backup_records (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    file_name TEXT NOT NULL UNIQUE CHECK (length(trim(file_name)) > 0),
    from_version INTEGER NOT NULL CHECK (from_version >= 0),
    to_version INTEGER NOT NULL CHECK (to_version > from_version),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
