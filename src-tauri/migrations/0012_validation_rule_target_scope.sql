UPDATE validation_issues
SET status = 'resolved',
    resolved_at = COALESCE(
        resolved_at,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE issue_type = 'unexpected_present'
  AND status != 'resolved';

UPDATE project_validation_state
SET health = CASE
        WHEN EXISTS (
            SELECT 1
            FROM validation_issues i
            WHERE i.project_id = project_validation_state.project_id
              AND i.status = 'open'
              AND i.issue_type IN ('source_unreadable', 'parse_issue')
        ) THEN 'unknown'
        WHEN EXISTS (
            SELECT 1
            FROM validation_issues i
            WHERE i.project_id = project_validation_state.project_id
              AND i.status = 'open'
              AND i.severity = 'error'
        ) THEN 'error'
        WHEN EXISTS (
            SELECT 1
            FROM validation_issues i
            WHERE i.project_id = project_validation_state.project_id
              AND i.status = 'open'
        ) THEN 'warning'
        ELSE 'healthy'
    END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE project_id IN (
    SELECT DISTINCT project_id
    FROM validation_issues
    WHERE issue_type = 'unexpected_present'
);
