-- Metadata-only dirty markers run in the originating repository transaction.
-- They never copy credentials, file paths, or parser contents into the queue.
CREATE TABLE cloud_sync_config (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 api_url TEXT NOT NULL DEFAULT '', workspace_id TEXT, device_id TEXT, stream_id TEXT,
 last_successful_at TEXT, blocked_code TEXT, retry_at INTEGER, retry_attempt INTEGER NOT NULL DEFAULT 0
);
INSERT INTO cloud_sync_config(singleton) VALUES(1);
CREATE TABLE cloud_sync_scopes (
 scope_kind TEXT NOT NULL CHECK(scope_kind IN('project','agentAccount')), scope_id TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, acknowledged_revision INTEGER NOT NULL DEFAULT 0,
 acknowledged_snapshot_id TEXT,
 changed_at INTEGER NOT NULL DEFAULT(unixepoch()), PRIMARY KEY(scope_kind,scope_id)
);
CREATE INDEX cloud_sync_pending_idx ON cloud_sync_scopes(acknowledged_revision,revision,changed_at);
CREATE TABLE cloud_sync_uploads (
 snapshot_id TEXT PRIMARY KEY, scope_kind TEXT NOT NULL, scope_id TEXT NOT NULL, revision INTEGER NOT NULL,
 manifest TEXT NOT NULL, chunks TEXT NOT NULL,
 UNIQUE(scope_kind,scope_id), FOREIGN KEY(scope_kind,scope_id) REFERENCES cloud_sync_scopes(scope_kind,scope_id) ON DELETE CASCADE
);
INSERT INTO cloud_sync_scopes(scope_kind,scope_id) SELECT 'project',id FROM projects;
INSERT INTO cloud_sync_scopes(scope_kind,scope_id) SELECT 'agentAccount',id FROM agent_accounts;

CREATE TRIGGER cloud_sync_projects_insert AFTER INSERT ON projects
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_projects_update AFTER UPDATE ON projects
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_projects_delete AFTER DELETE ON projects
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environments_insert AFTER INSERT ON environments
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environments_update AFTER UPDATE ON environments
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environments_delete AFTER DELETE ON environments
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_sources_insert AFTER INSERT ON environment_sources
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_sources_update AFTER UPDATE ON environment_sources
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_sources_delete AFTER DELETE ON environment_sources
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_definitions_insert AFTER INSERT ON environment_key_definitions
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_definitions_update AFTER UPDATE ON environment_key_definitions
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_definitions_delete AFTER DELETE ON environment_key_definitions
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_occurrences_insert AFTER INSERT ON environment_key_occurrences
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_occurrences_update AFTER UPDATE ON environment_key_occurrences
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_occurrences_delete AFTER DELETE ON environment_key_occurrences
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_rules_insert AFTER INSERT ON environment_key_rules
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_rules_update AFTER UPDATE ON environment_key_rules
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_rules_delete AFTER DELETE ON environment_key_rules
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_rule_targets_insert AFTER INSERT ON environment_key_rule_targets
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_rule_targets_update AFTER UPDATE ON environment_key_rule_targets
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_environment_key_rule_targets_delete AFTER DELETE ON environment_key_rule_targets
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_validation_issues_insert AFTER INSERT ON validation_issues
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_validation_issues_update AFTER UPDATE ON validation_issues
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_validation_issues_delete AFTER DELETE ON validation_issues
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_project_validation_state_insert AFTER INSERT ON project_validation_state
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_project_validation_state_update AFTER UPDATE ON project_validation_state
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_project_validation_state_delete AFTER DELETE ON project_validation_state
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credential_project_links_insert AFTER INSERT ON credential_project_links
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credential_project_links_update AFTER UPDATE ON credential_project_links
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credential_project_links_delete AFTER DELETE ON credential_project_links
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credential_environment_links_insert AFTER INSERT ON credential_environment_links
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credential_environment_links_update AFTER UPDATE ON credential_environment_links
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',NEW.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credential_environment_links_delete AFTER DELETE ON credential_environment_links
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('project',OLD.project_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_agent_accounts_insert AFTER INSERT ON agent_accounts
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('agentAccount',NEW.id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_agent_accounts_update AFTER UPDATE ON agent_accounts
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('agentAccount',NEW.id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_agent_accounts_delete AFTER DELETE ON agent_accounts
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('agentAccount',OLD.id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_agent_quota_windows_insert AFTER INSERT ON agent_quota_windows
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('agentAccount',NEW.account_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_agent_quota_windows_update AFTER UPDATE ON agent_quota_windows
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('agentAccount',NEW.account_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_agent_quota_windows_delete AFTER DELETE ON agent_quota_windows
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) VALUES('agentAccount',OLD.account_id)
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credential_sources_metadata AFTER UPDATE OF name, sort_order ON credential_sources
WHEN OLD.name IS NOT NEW.name OR OLD.sort_order IS NOT NEW.sort_order
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) SELECT 'project',project_id FROM (SELECT DISTINCT l.project_id FROM credential_project_links l JOIN credentials c ON c.id=l.credential_id WHERE c.source_id=NEW.id) WHERE 1
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

CREATE TRIGGER cloud_sync_credentials_metadata AFTER UPDATE OF key_name, source_id ON credentials
WHEN OLD.key_name IS NOT NEW.key_name OR OLD.source_id IS NOT NEW.source_id
BEGIN
 INSERT INTO cloud_sync_scopes(scope_kind,scope_id) SELECT 'project',project_id FROM (SELECT project_id FROM credential_project_links WHERE credential_id=NEW.id) WHERE 1
 ON CONFLICT(scope_kind,scope_id) DO UPDATE SET revision=revision+1,changed_at=unixepoch();
END;

