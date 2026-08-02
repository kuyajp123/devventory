# Devventory engineering rules

## Scope

- Keep the application offline-first. Phase 4 permits local file metadata inventory, persistent scan history, bounded project-scoped search, native watching, reconciliation, and missing-file recovery.
- Phase 2 owns application state, the SQLite pool, versioned migrations, pre-migration backups, repository contracts, shared errors, tracing, and UUID identifiers. Phase 3 owns project roots, watched locations, exclusions, and onboarding. Phase 4 must reuse those foundations.
- Preserve the current Tauri window size, minimum size, centering, label, and resizable settings.

## Architecture

- Organize product behavior under `src/features/<feature>/` and colocate its pages, components, services, state, and tests there.
- Export cross-feature entry points only from `src/features/<feature>/index.ts`; application code must not deep-import feature internals.
- Keep composition, routing, layouts, global providers, and shell-only state under `src/app/`.
- Promote code to `src/shared/` only after it is used by more than one feature or represents a true infrastructure boundary.
- Keep Tauri IPC behind typed gateways. UI components must not call `invoke` directly.
- Mirror feature-first ownership in Rust under `src-tauri/src/features/<feature>/`; commands are boundaries and must delegate SQL to feature repositories.
- Keep database connection, migration, backup mechanics, shared errors, and telemetry under `src-tauri/src/shared/`.
- Keep migrations append-only under `src-tauri/migrations/` and preserve LF line endings so SQLx checksums remain stable.
- Project onboarding frontend code stays colocated under `src/features/projects/` and exposes app-facing pages and types only through its `index.ts`.
- Project commands stay thin; path rules and scanning belong to the Rust project service/filesystem adapter, and project SQL belongs to the project repository.
- File-inventory frontend code stays colocated under `src/features/file-inventory/` and exposes app-facing pages and event synchronization only through its `index.ts`.
- File-inventory Rust code stays under `src-tauri/src/features/file_inventory/`; scanning, categorization, reconciliation, and watcher event processing belong to services/domain modules, while all inventory SQL belongs to its repository.
- Inventory scans store metadata only, stay inside canonical registered roots, apply exclusions before descent, skip symbolic links and junctions, use bounded batches, and never expose raw filesystem errors.
- Watcher callbacks only enqueue bounded, sanitized change signals. Services and repositories perform authoritative reconciliation and persistence.
- Do not add asset management, tags, notes, environment-file parsing, persistent content search, global search, dashboards, cloud sync, or any Phase 5+ behavior.
- Do not add cloud, Supabase, HTTP-sync, or broad frontend filesystem dependencies or permissions.

## Commands

- Frontend: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`.
- Rust (from `src-tauri`): `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `cargo check`, and `cargo audit` when `cargo-audit` is installed.
- Use Conventional Commits. Pre-commit hooks format and lint staged files; the commit-message hook runs commitlint.

## Change discipline

- Keep tests colocated with the behavior they cover, except browser journeys under `e2e/`.
- Add behavior with a failing test first and keep each change small enough to verify independently.
- Preserve working configuration and unrelated user changes.
