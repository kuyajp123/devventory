# Implementation Plan: Phase 2 Rust and SQLite Foundation

## Overview

Implement the Phase 2 backend foundation from `docs/Devventory_Implementation_Plan.md` without exposing Phase 3 project onboarding. The result will initialize a local SQLite database in Tauri application-local data, create consistent pre-migration snapshots, run embedded versioned migrations, manage the database through Tauri state, expose typed command failures, and prove feature-owned repositories against temporary SQLite databases.

## Locked Architecture Decisions

- Use SQLx 0.9 with its bundled SQLite driver, Tokio runtime, and embedded migration support.
- Store the database under Tauri's application-local data directory; tests inject temporary directories.
- Keep SQL inside feature repository implementations or database infrastructure.
- Limit the first migration to `application_settings` and `backup_records`; Phase 3 owns project tables.
- Detect unapplied embedded migrations before creating a backup. Use parameterized `VACUUM INTO` so the snapshot is consistent with WAL databases.
- Use UUID v4 identifiers for foundation records.
- Keep internal `thiserror` sources private and serialize only stable, safe command error codes and messages.
- Emit structured tracing events without settings values, file contents, secrets, or full database paths.

## Task List

### Task 1: Lock Rust dependencies and module contracts

**Acceptance criteria:**

- Cargo enables only the required SQLx SQLite/migration/runtime features plus UUID, thiserror, tracing, and test utilities.
- Shared error and telemetry modules compile without changing the frontend command contract.

**Verification:** `cargo check`

### Task 2: Initialize SQLite and embedded migrations

**Acceptance criteria:**

- A pool is created with foreign keys, WAL, a busy timeout, and bounded connections.
- Embedded migrations create only foundation tables and are tracked by SQLx.
- Migration SQL is forced to LF in Git for stable SQLx checksums.

**Verification:** focused Rust migration tests

### Task 3: Create and verify pre-migration backups

**Acceptance criteria:**

- Existing databases with pending migrations receive one consistent snapshot before migration.
- New or fully migrated databases do not receive unnecessary snapshots.
- A failed or corrupt snapshot blocks migration and does not become a valid backup.

**Verification:** focused temporary-database backup tests

### Task 4: Add feature-owned repository contracts

**Acceptance criteria:**

- Settings and backup records use feature-owned models and repository traits.
- SQLite implementations use parameterized queries and do not expose database rows.
- UUID-backed records persist and load correctly from temporary databases.

**Verification:** colocated repository integration tests

### Task 5: Wire Tauri application state and typed command errors

**Acceptance criteria:**

- Tauri setup resolves application-local data, initializes the database, and manages `AppState`.
- `health_check` confirms the managed pool is responsive while retaining its string success contract.
- Internal database/filesystem details never appear in serialized command errors.

**Verification:** command-error tests, `cargo test`, frontend contract tests

### Task 6: Extend quality gates and documentation

**Acceptance criteria:**

- CI validates migrations and audits the Rust lockfile in addition to existing checks.
- `AGENTS.md` and the README document the Phase 2 ownership boundaries and commands.
- No project onboarding, folder picker, scanner, cloud, Supabase, or HTTP-sync code is added.

**Verification:** all frontend gates, Rust format/Clippy/test/check, dependency audit, and final diff review

## Risks and Mitigations

| Risk                                                | Impact | Mitigation                                                      |
| --------------------------------------------------- | ------ | --------------------------------------------------------------- |
| Copying only the main SQLite file can omit WAL data | High   | Use SQLite `VACUUM INTO` for a transactional snapshot           |
| Migration checksum drift across Windows and CI      | High   | Force migration SQL to LF with `.gitattributes`                 |
| Raw SQLx or filesystem errors cross IPC             | High   | Map internal errors to a stable serializable command error DTO  |
| Future feature schema leaks into Phase 2            | Medium | Limit migration ownership to settings and backup records        |
| A test leaves SQLite handles open on Windows        | Medium | Explicitly close pools before temporary directories are dropped |

## Open Questions

None blocking. Phase 3 will decide the project schema and onboarding commands.
