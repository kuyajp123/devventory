CREATE TABLE agent_reminders_new (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES agent_accounts(id) ON DELETE CASCADE,
    quota_window_id TEXT NOT NULL REFERENCES agent_quota_windows(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('before_reset', 'reset_day', 'reset_reached')),
    reset_occurrence TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'delivered', 'skipped')),
    claimed_at TEXT,
    claim_expires_at TEXT,
    claim_token TEXT,
    delivered_at TEXT,
    skipped_at TEXT,
    skip_reason TEXT CHECK (skip_reason IS NULL OR skip_reason IN ('stale', 'intentionally_suppressed')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (quota_window_id, kind, reset_occurrence)
);

INSERT INTO agent_reminders_new (
    id, account_id, quota_window_id, kind, reset_occurrence, scheduled_for,
    status, delivered_at, created_at
)
SELECT
    id, account_id, quota_window_id, kind, reset_occurrence, scheduled_for,
    CASE WHEN delivered_at IS NOT NULL THEN 'delivered' ELSE 'pending' END,
    delivered_at, created_at
FROM agent_reminders;

DROP TABLE agent_reminders;
ALTER TABLE agent_reminders_new RENAME TO agent_reminders;

CREATE INDEX agent_reminders_status_due_idx
    ON agent_reminders(status, scheduled_for)
    WHERE status IN ('pending', 'claimed');
