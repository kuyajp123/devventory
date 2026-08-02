# Implementation Plan: Phase 4 File Inventory and Watching

## Objective

Implement only Phase 4 from `docs/Devventory_Implementation_Plan.md`: persistent file metadata inventory, deterministic categorization, paginated search/filtering, manual and startup reconciliation, native file watching, missing-file recovery, and frontend refresh after native changes. Phase 5 environment parsing and every later phase remain out of scope.

## Locked Contracts

- Preserve the Phase 1-3 feature-first dependency direction and keep the new frontend feature under `src/features/file-inventory/` with a controlled `index.ts` API.
- Keep Tauri commands thin. Rust services own scan/reconciliation rules, filesystem adapters own traversal and watcher mechanics, and repositories own all SQL.
- Reuse canonical project roots, relative watched locations, exclusions, SQLite state, UUIDs, typed errors, and tracing from Phases 2-3.
- Store file identity as a stable UUID plus unique `(project_id, relative_path)`. Store only metadata; never read or persist file contents.
- Determine MIME type only from the extension. Use deterministic extension/category rules and an `other` fallback.
- Exclude symbolic links and Windows reparse points. Never traverse a link target, even when it resolves inside the root.
- Stream scan results through bounded batches rather than returning an entire inventory in memory.
- Mark unseen records missing only after an authoritative, completed scan for the relevant scope. Partial, failed, unavailable-root, and ambiguous scans preserve existing status.
- Keep missing records so reappearance can reactivate the same local identity at the same relative path.
- Keep watcher intake bounded and debounced. Coalesce logical changes and use a full project reconciliation for correctness when native events are ambiguous, renamed, moved, or dropped.
- Expose paginated inventory queries with bounded page sizes and parameterized filters. Phase 8 full-text search is not introduced.
- Invalidate only the affected project inventory query prefix after a successful manual scan or backend inventory event.
- No hashes are computed in Phase 4 because no demonstrated feature requires them.

## Threat Model

| Threat                                                                       | Boundary                                        | Mitigation                                                                                                                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Traversal or watched path escapes the approved root                          | Stored project configuration to scanner/watcher | Re-canonicalize the root and each watched location; reject anything outside the root; never accept frontend-provided absolute inventory paths |
| Symlink/junction escape or cycle                                             | Recursive traversal                             | Inspect link metadata, skip symlinks/reparse points, and never follow them                                                                    |
| Inaccessible or temporarily unavailable storage creates mass false deletions | Filesystem to reconciliation                    | Record partial/failed scan status and never mark unseen rows missing unless the scan completes authoritatively                                |
| Event storms exhaust memory or run overlapping scans                         | OS watcher to service                           | Bounded queue, debounce/coalescing, serialized reconciliation, and overflow-to-full-reconciliation fallback                                   |
| Search input alters SQL                                                      | Frontend/IPC to repository                      | Validate lengths/enums/page bounds and bind all values through SQLx query parameters                                                          |
| Sensitive local data is leaked                                               | DTO/log boundary                                | Return relative paths and metadata only; do not read contents; log project/scan IDs and counts, never file contents or environment values     |
| Large projects exhaust memory or stall UI                                    | Scanner/query boundary                          | Fixed scan batch size, bounded channels, blocking traversal off the async runtime, paginated queries, and indexed filter columns              |

## Ordered Slices

### 1. Schema and public contracts

- Add append-only `0003_file_inventory.sql` for `indexed_files` and `scan_runs` with constraints and indexes.
- Define Rust inventory models, DTOs, typed errors, and repository/service interfaces.
- Add failing migration, categorization, filter-validation, and repository tests first.

### 2. Authoritative scanner and reconciliation

- Add a safe recursive scanner over configured watched locations.
- Capture relative path, name, extension, extension-derived MIME, size, modified timestamp, category, source, and watched-location ID.
- Stream fixed-size batches to SQLite and record added/updated/unchanged/missing/excluded/unreadable counts.
- Support initial/startup/manual-project/manual-location/watcher scan kinds and completed/partial/failed status.

### 3. Query and rescan IPC

- Add paginated searchable/filterable inventory and recent scan DTOs.
- Add full-project and watched-location rescan commands.
- Register commands without expanding Tauri filesystem permissions.

### 4. Frontend inventory feature

- Add Zod-validated gateway contracts and TanStack Query hooks.
- Add a responsive inventory page with search, category/extension/status filters, pagination, scan status, empty/loading/error states, and manual rescan actions.
- Link the public page from routing and project details without deep imports.

### 5. Native watcher and reconciliation lifecycle

- Add a testable notify adapter, logical event coalescer, bounded runtime queue, and serialized reconciliation worker.
- Register project watched locations at startup, reconcile all projects at startup, refresh watcher registrations after new project creation, and emit safe project-scoped inventory change events.
- Add frontend event cleanup and query invalidation.

### 6. Validation and scope review

- Run all existing frontend and Rust checks, plus focused inventory tests and Playwright when supported.
- Review filesystem safety, query bounds, event overload behavior, error sanitization, file sizes, feature boundaries, and Phase 5 scope exclusion.
- Update `AGENTS.md` and this checklist to describe the implemented Phase 4 boundary.

## Definition of Done

- A registered project can be reconciled into persistent, queryable file metadata without reading file contents.
- Create/modify/delete/rename/move changes converge correctly through native watching and reconciliation.
- Partial failures are visible and cannot silently mark the entire inventory missing.
- UI users can search/filter/page through records, inspect last scan state, and trigger project or watched-location rescans.
- Tests cover categorization, exclusions, traversal/link safety, batch persistence, missing/recovery, pagination/filtering, event coalescing, typed IPC parsing, query invalidation, and key UI states.
- No Phase 5+ behavior, cloud/HTTP dependency, environment parsing, file content storage, or broad filesystem permission is added.
