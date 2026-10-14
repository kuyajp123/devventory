CREATE TABLE cloud_workspaces (
  workspace_id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  publisher_device_id TEXT,
  publisher_generation INTEGER NOT NULL DEFAULT 0,
  last_cleanup_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE cloud_devices (
  workspace_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  registration_hash TEXT NOT NULL,
  generation INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (workspace_id, device_id),
  UNIQUE (workspace_id, registration_hash),
  FOREIGN KEY (workspace_id) REFERENCES cloud_workspaces(workspace_id)
);
CREATE INDEX cloud_workspaces_cleanup_idx ON cloud_workspaces(last_cleanup_at, workspace_id);
