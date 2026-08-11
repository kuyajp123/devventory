# Implementation Plan: Environment Tracker + Validation Center Integration

## Objective

Unify Environment Tracker and Validation Center into one fixed-height, tabbed
developer workbench while preserving the existing Rust validation domain,
environment-tracker behavior, backend authority, server pagination, current
theme, and all unrelated local changes.

## Locked contracts

- Tabs are route-backed: Environments is the default, with Rules & Health and
  Issues as integrated modes. `/validation` remains a compatibility redirect.
- Structural state stays in the existing cell chip. Validation changes only the
  cell's outer border, using the highest open severity.
- Selection uses a neutral inset treatment and never overwrites validation
  severity styling.
- Matrix data remains one server-paginated query. Active rule-only keys join the
  same search/page universe; disabled-rule-only keys are omitted.
- Matrix validation details are projected in bounded backend queries, never with
  per-cell IPC or SQL calls.
- Validation rules, issues, summaries, lifecycle, and SQL remain owned by the
  validation-center backend. Environment structural data remains owned by the
  environment-tracker backend.
- Existing Compare/Inspect, source management, reordering, refresh, issue
  history, manifest export, and mutation flows are reused rather than rebuilt.
- The workbench has one primary scroll plane per active tab; title, tabs, tab
  actions, and pagination stay fixed.

## Ordered vertical slices

### 1. Regression tests and integrated contracts

- Add failing frontend tests for route tabs, edit-form reset/population,
  severity presentation, neutral selection, Add Rule, and query invalidation.
- Add failing Rust tests for active rule-only key union, search/pagination,
  disabled-rule omission, and bounded validation projection.
- Extend typed frontend/Rust matrix DTO contracts with cell validation details.

### 2. Backend matrix composition

- Add validation-repository reads for active matrix rule keys and open issue
  projections over a bounded page of keys/environments.
- Allow the environment repository to merge provided rule keys with observed
  definitions before search, sort, count, and pagination without querying
  validation tables directly.
- Add a cross-feature workspace service that composes both feature services and
  enriches one matrix page in bulk.
- Keep the Tauri matrix command thin and return safe DTOs only.

### 3. Frontend matrix and inspector integration

- Parse validation projection fields in the existing matrix gateway.
- Map highest open severity to accessible outer-border presentation.
- Keep structural chips unchanged and replace blue selection borders with a
  neutral inset state in Compare and Inspect.
- Extend the key inspector with structural status, applicable rules, and all
  open cell issues while preserving source detail behavior.
- Convert Inspect to the same server-pagination path, scoped to one environment.

### 4. Unified route-backed workbench

- Add Environments, Rules & Health, and Issues tabs under `/environments`.
- Extract reusable validation controllers/panels and reuse the same Add/Edit
  Rule modal from the matrix toolbar and Rules & Health.
- Fix rule-form lifecycle reset so edit/create switching always shows current
  values without false dirty state.
- Bound rule and issue content with internal scrolling and pinned pagination.
- Redirect `/validation` to `/environments/rules` and remove the separate
  Validation Center navigation item.

### 5. Verification and scope review

- Run focused unit and Rust tests while iterating.
- Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, and
  `npm run build`.
- From `src-tauri`, run `cargo fmt --check`, `cargo check`,
  `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test`
  with long waits.
- Manually inspect the fixed-height tab workspaces when the Tauri runtime is
  supported, using an available port and without changing the UI theme.
- Review the final diff for N+1 calls, duplicated state, backend-boundary leaks,
  unrelated redesign, and accidental release or Git actions.

## Definition of done

- The integrated route exposes all three modes and keeps `/validation`
  compatible.
- Rule creation/editing is shared and the Environment Key edit regression is
  covered by tests.
- Active rule-only keys appear once with correct server totals/search/pages.
- Open validation issues style cells by highest severity without changing
  structural chips; historical statuses do not affect borders.
- Compare and Inspect use neutral selection and preserve validation borders.
- Inspector, Rules & Health, and Issues expose the required details and actions
  in bounded scroll regions.
- All claimed checks are actually run and their exact outcomes are reported.
