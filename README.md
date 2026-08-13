# Devventory

Devventory is an offline-first Tauri desktop application for keeping a local inventory of project files and environments.

## Foundation commands

- `npm run dev` starts the browser development server.
- `npm run tauri dev` starts the desktop application in development mode.
- `npm run lint`, `npm run format:check`, and `npm run typecheck` run static checks.
- `npm run test:unit` runs the Vitest suite.
- `npm run test:e2e` runs browser-compatible Playwright tests with mocked Tauri IPC.
- `npm run build` type-checks and creates the frontend production bundle.
- `npm run ci:local` runs the complete frontend, browser, Rust, and dependency-audit quality suite on the local Windows computer.

Rust checks run from `src-tauri` with `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, and `cargo check`. The local quality suite also audits `Cargo.lock` with RustSec's `cargo-audit`.

## Local CI automation

GitHub-hosted CI does not run automatically on pushes or pull requests. The repository's Git `pre-push` hook runs the complete local suite before every `git push`; a failing check exits nonzero and prevents the push. `npm ci` installs the tracked hooks automatically through the package `prepare` script.

Prepare a new Windows checkout once with:

```powershell
npm ci
npm exec playwright install chromium --only-shell
rustup component add clippy rustfmt
cargo install cargo-audit --locked
```

Run the same gate at any time with `npm run ci:local`. Git's `git push --no-verify` escape hatch bypasses the local hook and should be reserved for a deliberate emergency. The GitHub Actions workflow remains manual-only as an explicit hosted fallback and consumes no runner minutes unless a maintainer starts it from the Actions page.

See the [Local CI and Protected Main Workflow Manual](docs/local-ci-protected-main-workflow-manual.md) for setup, feature-branch and pull-request procedures, VS Code behavior, troubleshooting, limitations, and the future automated-release handoff.

## Local persistence foundation

Phase 2 initializes an SQLx SQLite pool in Tauri's application-local data directory. Embedded, versioned migrations create only foundation-owned settings and backup metadata tables. When an existing database has pending migrations, Devventory creates and verifies a consistent SQLite snapshot before applying them.

Rust code follows the same feature-first boundary as the frontend: settings and backup SQL is owned by repositories under `src-tauri/src/features/`; connection, migration, snapshot, error, and tracing mechanics live under `src-tauri/src/shared/`. Tauri commands receive managed application state and serialize stable error codes rather than raw SQLx or filesystem errors.

Project onboarding, project tables, folder selection, scanning, cloud services, Supabase, and HTTP synchronization remain intentionally out of scope until their later phases.
