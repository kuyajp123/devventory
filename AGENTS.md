# Devventory engineering rules

## Scope

- Keep the application offline-first. The current product phase includes local project onboarding, window-level active-project selection, project-scoped file inventory, and the local Asset Library with metadata and variants.
- Reuse the existing application state, SQLite pool, versioned migrations, pre-migration backups, repository contracts, shared errors, tracing, UUID identifiers, project roots, watched locations, exclusions, scanning, reconciliation, and watcher runtime.
- Preserve the current Tauri window size, minimum size, centering, label, and resizable settings.
- The Dashboard may present already-available project configuration and initial-scan data. Do not add new analytics queries or broader filesystem access for the initial Dashboard iteration.

## Architecture

- Organize product behavior under `src/features/<feature>/` and colocate its pages, components, services, state, and tests there.
- Export cross-feature entry points only from `src/features/<feature>/index.ts`; application code must not deep-import feature internals.
- Keep composition, routing, layouts, global providers, and shell-only state under `src/app/`.
- Promote code to `src/shared/` only after it is used by more than one feature or represents a true infrastructure boundary.
- Keep Tauri IPC behind typed gateways. UI components must not call `invoke` directly.
- Mirror feature-first ownership in Rust under `src-tauri/src/features/<feature>/`; commands are boundaries and must delegate SQL to feature repositories.
- Keep database connection, migration, backup mechanics, shared errors, and telemetry under `src-tauri/src/shared/`.
- Keep migrations append-only under `src-tauri/migrations/` and preserve LF line endings so SQLx checksums remain stable.
- Project onboarding, active-project selection, project persistence gateways, and selector UI stay colocated under `src/features/projects/` and expose app-facing pages, hooks, components, and types only through its `index.ts`.
- Project commands stay thin; path rules and scanning belong to the Rust project service/filesystem adapter, and project SQL belongs to the project repository.
- Settings commands stay thin and delegate persistence to the Rust settings repository. Existing `application_settings` keys should be reused when no schema change is required.
- File-inventory frontend code stays colocated under `src/features/file-inventory/` and exposes app-facing pages and event synchronization only through its `index.ts`.
- File-inventory Rust code stays under `src-tauri/src/features/file_inventory/`; scanning, categorization, reconciliation, and watcher event processing belong to services/domain modules, while all inventory SQL belongs to its repository.
- Asset Library frontend and Rust behavior stay under their existing feature modules. Asset queries, actions, imports, variants, and metadata remain explicitly project-scoped.
- Inventory scans store metadata only, stay inside canonical registered roots, apply exclusions before descent, skip symbolic links and junctions, use bounded batches, and never expose raw filesystem errors.
- Watcher callbacks only enqueue bounded, sanitized change signals. Services and repositories perform authoritative reconciliation and persistence.
- Do not add environment-file parsing, persistent content search, global search, cloud sync, Supabase, HTTP synchronization, or broad frontend filesystem dependencies or permissions.

## Commands

- Frontend: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`.
- Rust (from `src-tauri`): `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `cargo check`, and `cargo audit` when `cargo-audit` is installed.
- Use Conventional Commits. Pre-commit hooks format and lint staged files; the commit-message hook runs commitlint.

## Change discipline

- Keep tests colocated with the behavior they cover, except browser journeys under `e2e/`.
- Add behavior with a failing test first and keep each change small enough to verify independently.
- Preserve working configuration and unrelated user changes.
