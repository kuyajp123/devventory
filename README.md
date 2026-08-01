# Devventory

Devventory is an offline-first Tauri desktop application for keeping a local inventory of project files and environments.

## Foundation commands

- `npm run dev` starts the browser development server.
- `npm run tauri dev` starts the desktop application in development mode.
- `npm run lint`, `npm run format:check`, and `npm run typecheck` run static checks.
- `npm run test:unit` runs the Vitest suite.
- `npm run test:e2e` runs browser-compatible Playwright tests with mocked Tauri IPC.
- `npm run build` type-checks and creates the frontend production bundle.

Rust checks run from `src-tauri` with `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, and `cargo check`.

Phase 1 establishes only the application shell and development quality gates. Project onboarding, persistence, filesystem access, cloud services, and HTTP synchronization are intentionally out of scope.
