CREATE TABLE workspace_state (
  workspace_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, stream_id TEXT NOT NULL
);
CREATE TABLE snapshots (
  workspace_id TEXT NOT NULL, id TEXT NOT NULL, stream_id TEXT NOT NULL,
  scope_kind TEXT NOT NULL, scope_id TEXT NOT NULL, revision INTEGER NOT NULL,
  manifest TEXT NOT NULL, manifest_hash TEXT NOT NULL, observed_at TEXT NOT NULL,
  tombstone INTEGER NOT NULL, published_at TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, stream_id, scope_kind, scope_id, revision)
);
CREATE TABLE snapshot_chunks (
  workspace_id TEXT NOT NULL, snapshot_id TEXT NOT NULL, chunk_index INTEGER NOT NULL,
  hash TEXT NOT NULL, record_count INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, snapshot_id, chunk_index),
  FOREIGN KEY (workspace_id, snapshot_id) REFERENCES snapshots(workspace_id, id) ON DELETE CASCADE
);
CREATE TABLE cloud_records (
  workspace_id TEXT NOT NULL, snapshot_id TEXT NOT NULL, kind TEXT NOT NULL,
  id TEXT NOT NULL, payload TEXT NOT NULL,
  PRIMARY KEY (workspace_id, snapshot_id, kind, id),
  FOREIGN KEY (workspace_id, snapshot_id) REFERENCES snapshots(workspace_id, id) ON DELETE CASCADE
);
CREATE TABLE scope_heads (
  workspace_id TEXT NOT NULL, scope_kind TEXT NOT NULL, scope_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL, revision INTEGER NOT NULL, tombstone INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, scope_kind, scope_id)
);
CREATE INDEX records_kind_idx ON cloud_records(workspace_id, snapshot_id, kind, id);
CREATE INDEX snapshots_gc_idx ON snapshots(workspace_id, created_at);
