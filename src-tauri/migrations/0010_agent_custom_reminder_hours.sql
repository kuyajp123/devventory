CREATE TABLE agent_quota_windows_new (
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
    before_reset_hours INTEGER CHECK (
        before_reset_hours IS NULL OR (before_reset_hours >= 1 AND before_reset_hours <= 720)
    ),
    remind_reset_day INTEGER NOT NULL DEFAULT 1 CHECK (remind_reset_day IN (0, 1)),
    remind_reset_reached INTEGER NOT NULL DEFAULT 1 CHECK (remind_reset_reached IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (account_id, normalized_label)
);

INSERT INTO agent_quota_windows_new (
    id, account_id, label, normalized_label, remaining_percent, reset_at, timezone,
    tracking_source, usage_updated_at, usage_is_stale, reset_reached_at,
    before_reset_hours, remind_reset_day, remind_reset_reached, created_at, updated_at
)
SELECT
    id, account_id, label, normalized_label, remaining_percent, reset_at, timezone,
    tracking_source, usage_updated_at, usage_is_stale, reset_reached_at,
    CASE WHEN remind_one_day = 1 THEN 24 ELSE NULL END,
    remind_reset_day, remind_reset_reached, created_at, updated_at
FROM agent_quota_windows;

CREATE TABLE agent_reminders_new (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES agent_accounts(id) ON DELETE CASCADE,
    quota_window_id TEXT NOT NULL REFERENCES agent_quota_windows_new(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('before_reset', 'reset_day', 'reset_reached')),
    reset_occurrence TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (quota_window_id, kind, reset_occurrence)
);

INSERT INTO agent_reminders_new (id, account_id, quota_window_id, kind, reset_occurrence, scheduled_for, delivered_at, created_at)
SELECT id, account_id, quota_window_id,
       CASE WHEN kind = 'one_day_before' THEN 'before_reset' ELSE kind END,
       reset_occurrence, scheduled_for, delivered_at, created_at
FROM agent_reminders;

DROP TABLE agent_reminders;
DROP TABLE agent_quota_windows;

ALTER TABLE agent_quota_windows_new RENAME TO agent_quota_windows;
ALTER TABLE agent_reminders_new RENAME TO agent_reminders;

CREATE INDEX agent_quota_windows_account_reset_idx
    ON agent_quota_windows(account_id, reset_at);
CREATE INDEX agent_quota_windows_reset_idx
    ON agent_quota_windows(reset_at) WHERE reset_reached_at IS NULL;
CREATE INDEX agent_reminders_due_idx
    ON agent_reminders(scheduled_for) WHERE delivered_at IS NULL;
