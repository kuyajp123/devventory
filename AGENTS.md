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

## Framework-neutral feature organization

- Treat this section as the portable baseline for application code. Preserve the repository- and platform-specific rules above; use the equivalent names and primitives supplied by the active framework rather than forcing React conventions into another framework.
- Organize code by product capability first. A feature owns its UI, routes or pages, state, data access, domain types, helpers, assets, and tests until those pieces are genuinely reused outside that feature.
- Keep one shared/global location only. A new application may use `src/shared/{components,hooks,stores,lib,services,types,helpers}` or the equivalent flat `src/{components,hooks,stores,lib,services,types,helpers}` layout, but never create both conventions in the same application. This repository uses `src/shared/` as its global location.
- Promote a module to the shared/global location only after it is used by more than one feature or represents an infrastructure boundary. Do not create generic shared abstractions pre-emptively.

### Preferred layout

```text
src/
├── app/                         # Composition, routing, providers, layouts, and bootstrap
├── features/
│   └── <feature>/
│       ├── index.ts              # The feature's public entry point
│       ├── components/           # Feature-only UI
│       ├── pages/                # Or views/, routes/, screens/, or containers/
│       ├── hooks/                # Or composables/ in frameworks that use them
│       ├── store/                # Feature-scoped client state, when needed
│       ├── services/             # API clients, gateways, repositories, and use cases
│       ├── types/                # Or models/, entities/, schemas/, and contracts/
│       ├── lib/                  # Feature-only pure helpers, utilities, and constants
│       ├── assets/               # Feature-only static assets, when needed
│       └── tests/                # Or colocated *.test.* / *.spec.* files
└── shared/                       # The single global location in this repository
    ├── components/
    ├── hooks/
    ├── stores/
    ├── lib/                      # Utilities, helpers, and infrastructure clients
    ├── services/
    └── types/
```

- Folders are optional: create only the folders a feature needs. Keep related tools such as schemas, constants, adapters, mocks, and test fixtures within the owning feature unless they meet the shared/global rule.
- Use a framework-appropriate entry extension (`index.ts`, `index.tsx`, `index.vue`, and so on). Export only the feature's supported public API from that entry point; consumers must not deep-import feature internals.
- Keep framework composition and application-wide concerns in `src/app/`; keep business behavior in a feature. A component or view must delegate data access and non-trivial business logic to its feature's hooks, services, or library code.

### Imports and boundaries

- Use the configured source-root alias for application imports. In projects that configure `@/`, including this repository, import source files with `@/...` instead of climbing directories with `../../...`. Keep alias configuration consistent across the compiler, bundler, test runner, linter, and editor.
- Use package imports for external dependencies and relative imports only when the toolchain cannot support the configured alias or for a direct framework-required neighbor import. Do not introduce a new alias without configuring every affected tool.
- Features may consume shared code and another feature's public entry point, but never another feature's private files. Avoid circular feature dependencies.

### State, async data, and HTTP

- Keep state that is used only by one React component or file in `useState`. In non-React frameworks, use the closest component-local state primitive rather than a global store.
- Use a feature-local `store/` or state module only for client state shared within that feature. Use Zustand for React client state that is truly global or shared across features; in non-React applications, use the framework's established equivalent. Do not elevate short-lived or feature-private state to a global store.
- Use TanStack React Query in React applications for async, cacheable server or gateway data when applicable. Colocate feature query hooks and query keys, invalidate only the affected keys after mutations, and do not duplicate query-cache data in Zustand. In other frameworks, use the configured framework-compatible query/cache solution instead.
- For HTTP APIs, use Axios consistently through a shared, configured client and feature-owned service functions rather than calling `fetch` directly. Keep endpoint contracts, error mapping, authentication, and interceptors at the client/service boundary; UI code must not call Axios directly. Do not add Axios when an application has no HTTP API or its platform forbids network access.
- In this offline-first Tauri application, typed Tauri gateways remain the required data boundary and replace HTTP/Axios calls. They are still appropriate inputs to React Query where cached asynchronous data is useful.

### Tests and maintainability

- Keep unit and integration tests inside the feature they exercise, either beside the source file or in that feature's `tests/` directory. Put shared-module tests beside their shared module; reserve top-level end-to-end tests for cross-feature user journeys.
- Name files by responsibility, keep functions and components small, and prefer explicit types/contracts at feature boundaries. Separate presentation, state orchestration, data access, and pure domain logic so each can change independently.
- Before moving code to a global folder, verify that it has a stable API and more than one real consumer. Preserve feature ownership whenever reuse is speculative.

## Commands

- Frontend: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`.
- Rust (from `src-tauri`): `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `cargo check`, and `cargo audit` when `cargo-audit` is installed.
- Use Conventional Commits. Pre-commit hooks format and lint staged files; the commit-message hook runs commitlint.

## Change discipline

- Keep tests colocated with the behavior they cover, except browser journeys under `e2e/`.
- Add behavior with a failing test first and keep each change small enough to verify independently.
- Preserve working configuration and unrelated user changes.
