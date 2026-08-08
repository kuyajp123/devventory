CREATE TABLE agent_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN (
        'codex', 'claude_code', 'devin', 'github_copilot', 'cursor',
        'kiro', 'antigravity', 'gemini_cli', 'windsurf', 'custom'
    )),
    custom_platform TEXT,
    normalized_custom_platform TEXT NOT NULL DEFAULT '',
    sign_in_method TEXT NOT NULL CHECK (sign_in_method IN (
        'google', 'github', 'microsoft', 'apple', 'email', 'phone',
        'organization_sso', 'other'
    )),
    identifier TEXT NOT NULL,
    normalized_identifier TEXT NOT NULL,
    tracking_mode TEXT NOT NULL DEFAULT 'manual'
        CHECK (tracking_mode IN ('manual', 'automatic_connector')),
    default_timezone TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (
        (platform = 'custom' AND custom_platform IS NOT NULL AND length(trim(custom_platform)) > 0)
        OR (platform <> 'custom' AND custom_platform IS NULL)
    ),
    UNIQUE (platform, normalized_custom_platform, sign_in_method, normalized_identifier)
);

CREATE TABLE agent_quota_windows (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES agent_accounts(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    normalized_label TEXT NOT NULL,
    remaining_percent REAL CHECK (
        remaining_percent IS NULL OR (remaining_percent >= 0 AND remaining_percent <= 100)
    ),
    reset_at TEXT NOT NULL,
    timezone TEXT NOT NULL,
    tracking_source TEXT NOT NULL CHECK (
        tracking_source IN ('manual', 'pasted', 'automatic_connector')
    ),
    usage_updated_at TEXT,
    usage_is_stale INTEGER NOT NULL DEFAULT 0 CHECK (usage_is_stale IN (0, 1)),
    reset_reached_at TEXT,
    remind_one_day INTEGER NOT NULL DEFAULT 1 CHECK (remind_one_day IN (0, 1)),
    remind_reset_day INTEGER NOT NULL DEFAULT 1 CHECK (remind_reset_day IN (0, 1)),
    remind_reset_reached INTEGER NOT NULL DEFAULT 1 CHECK (remind_reset_reached IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (account_id, normalized_label)
);

CREATE TABLE agent_reminders (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES agent_accounts(id) ON DELETE CASCADE,
    quota_window_id TEXT NOT NULL REFERENCES agent_quota_windows(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('one_day_before', 'reset_day', 'reset_reached')),
    reset_occurrence TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (quota_window_id, kind, reset_occurrence)
);

CREATE INDEX agent_accounts_platform_identifier_idx
    ON agent_accounts(platform, normalized_identifier);
CREATE INDEX agent_quota_windows_account_reset_idx
    ON agent_quota_windows(account_id, reset_at);
CREATE INDEX agent_quota_windows_reset_idx
    ON agent_quota_windows(reset_at) WHERE reset_reached_at IS NULL;
CREATE INDEX agent_reminders_due_idx
    ON agent_reminders(scheduled_for) WHERE delivered_at IS NULL;
