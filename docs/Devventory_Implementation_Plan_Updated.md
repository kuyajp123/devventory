# Devventory Implementation Plan

## 1. Project Overview

### Product name

**Devventory**

### Product type

An offline-first desktop project inventory and configuration-management application for developers.

### Product purpose

Devventory provides developers with a centralized interface for organizing, indexing, locating, and validating project-related resources, including:

- Images and illustrations
- Documents and technical documentation
- Configuration files
- Environment-variable key names
- Project assets
- Development notes
- Project folder metadata
- Environment definitions
- Validation rules
- Coding-agent accounts, quota windows, usage snapshots, reset schedules, and reminders

A developer selects an existing project folder. Devventory then indexes selected folders and files, stores searchable metadata in SQLite, monitors configured locations for changes, and provides tools for importing assets directly into the project.

Devventory also includes a global **Agent Usage** module that is not tied to the selected project. It helps developers track which coding-agent account is currently usable, how much quota remains when known, and when each tracked quota window resets.

The first version's core workflows will work completely offline. Manual Agent Usage tracking must also work offline. Optional coding-agent connectors may use verified local CLI/application interfaces or provider APIs and may require internet access. Cloud synchronization, Devventory account authentication, and encrypted secret-value storage will be introduced in future versions.

---

## 2. Core Product Principles

### 2.1 Offline-first

The complete local MVP must work without:

- Internet access
- Devventory authentication
- Supabase
- A hosted Devventory API
- A cloud database

SQLite will store structured application data, while actual project files remain inside the developer’s project folders.

The Agent Usage module must remain useful in fully manual mode without internet access. Automatic provider synchronization is an optional enhancement and may require a local coding-agent installation, provider authentication that already exists on the device, or internet access to an official provider API.

### 2.2 Project files remain the source of truth

Devventory should not duplicate every file it discovers.

It will distinguish between:

#### Indexed files

Files already inside the selected project.

Only their metadata will be stored:

- File name
- Relative path
- File extension
- MIME type
- File size
- Modified date
- Category
- Tags
- Notes
- Optional file hash

#### Managed assets

Files imported through Devventory.

For example, a screenshot selected from the Downloads folder may be copied into:

```text
project-root/public/images/empty-states/
```

Devventory then indexes the copied file and records that it is a managed asset.

### 2.3 Local paths stay device-specific

Absolute paths must not be treated as portable cloud data.

Store both:

```text
root_path:
C:\Users\Paul\Projects\devventory

relative_path:
public/images/empty-state.svg
```

In future cloud synchronization, only the relative path should normally synchronize between devices.

### 2.4 Environment values are not stored in the MVP

Devventory will parse environment files but persist only:

- Key names
- Environment association
- Source file
- Line number
- Commented status
- Duplicate status
- Validation information

Given:

```env
SUPABASE_URL=https://example.supabase.co
SUPABASE_ANON_KEY=example-value
```

The MVP stores:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

It must not store or log their values.

### 2.5 Agent Usage is manual-first and connector-assisted

Agent Usage is a global developer-resource feature and is not scoped to the currently selected project.

The universal baseline is manual tracking. A developer can add any coding-agent platform and account without requiring a connector.

Each tracked account records:

- Coding-agent platform
- Sign-in method
- Full account identifier
- One or more quota windows
- Optional usage remaining
- Reset date and time
- Timezone
- Tracking source
- Last updated time

Supported sign-in-method choices should include:

```text
Google
GitHub
Microsoft
Apple
Email
Phone number
Organization / SSO
Other
```

The account identifier should be shown in full because its purpose is to help the developer distinguish the exact account to use. Examples include an email address, GitHub username, Microsoft account, phone number, organization identity, or another provider-specific identifier.

Do not add a second display-name field such as `Personal`, `Account A`, or `Account B` in the MVP. The real account identifier is the primary account label.

Default timezone:

```text
Asia/Manila
```

The timezone must still be stored as an IANA timezone identifier rather than a fixed UTC offset so the feature can expand later.

Usage remaining is optional. A quota window may be tracked with only a reset date/time.

When a manually tracked reset time is reached, Devventory may consider that quota window reset because the timestamp was supplied from the coding-agent platform. Devventory must not invent a new usage percentage after the reset. If the previous usage snapshot is stale, clear or mark it as not updated rather than assuming `100% remaining`.

Automatic connectors are optional. They must use documented or otherwise stable provider-supported integration surfaces. Devventory must not scrape private dashboards, read browser cookies, copy OAuth tokens, become a credential manager, or silently switch provider accounts.

Before implementing any automatic connector, the coding agent implementing this phase must independently verify the provider's current official capabilities and decide whether the connector is safe and stable enough to ship. Providers without a verified connector remain fully usable through manual tracking.

---

## 3. Architecture Style

Devventory will follow a:

> **Feature-first architecture with file colocation and lightweight clean architecture boundaries.**

Code will be organized primarily by product feature rather than by global technical folders.

Each feature owns its:

- Components
- Pages
- Query hooks
- Mutation hooks
- Types
- Validation schemas
- Services
- Tauri command adapters
- Zustand stores, when genuinely necessary
- Tests
- Feature-specific helpers

Application-wide code will be placed under `shared/` only when it is genuinely reused by unrelated features.

### 3.1 Colocation rule

A file should remain inside the feature that uses it.

For example:

```text
features/environment-tracker/
├── components/
├── queries/
├── services/
├── schemas/
├── types/
├── utils/
└── tests/
```

Do not distribute environment-tracker files across global directories such as:

```text
src/components/environments/
src/services/environment-service.ts
src/types/environment.ts
src/utils/environment-utils.ts
```

### 3.2 Shared-code rule

Move code to `shared/` only when:

1. At least two unrelated features use it.
2. It has no feature-specific business meaning.
3. Its abstraction is clearer than duplicating a small amount of code.
4. Moving it does not create unnecessary coupling.

A component used twice inside the same feature remains inside that feature.

### 3.3 Public feature APIs

Every feature will expose a controlled public API through `index.ts`.

```ts
// features/projects/index.ts

export { ProjectsPage } from "./pages/ProjectsPage";
export { ProjectSelector } from "./components/ProjectSelector";
export { useProjectQuery } from "./queries/project.queries";
export type { Project } from "./types/project.types";
```

Other features should import from:

```ts
import { ProjectSelector } from "@/features/projects";
```

They should not deep-import feature internals:

```ts
// Avoid
import { ProjectSelector } from "@/features/projects/components/ProjectSelector";
```

This reduces accidental coupling and makes feature refactoring easier.

---

## 4. Technology Stack

### 4.1 Core stack

- Tauri 2
- React
- TypeScript
- Rust
- SQLite
- Vite
- HeroUI
- Tailwind CSS

### 4.2 Frontend state and data tools

- TanStack Query
- Zustand
- Axios
- Zod
- React Hook Form
- TanStack Table
- dnd-kit
- Recharts

### 4.3 Rust tools

Recommended Rust dependencies include:

- `serde` for serialization
- `serde_json` for structured data
- `sqlx` with SQLite support
- `uuid` for identifiers
- `chrono` or `time` for timestamps
- `thiserror` for typed application errors
- `tracing` for structured logging
- A filesystem-watching implementation behind an application interface

### 4.4 Testing and quality tools

- Vitest
- React Testing Library
- Playwright
- WebdriverIO Tauri service
- Rust unit and integration tests
- ESLint
- Prettier
- Husky
- lint-staged
- commitlint
- Conventional Commits
- semantic-release

---

## 5. Tool Responsibilities

### 5.1 TanStack Query

TanStack Query will manage asynchronous persisted data, including data that comes from local Rust commands.

Although there is no remote server in the MVP, SQLite and filesystem results are still asynchronous external state from React’s perspective.

TanStack Query should manage:

- Project lists
- Project details
- Indexed files
- Asset lists
- Environment definitions
- Environment-key matrices
- Validation issues
- Coding-agent accounts
- Coding-agent quota windows
- Agent usage snapshots and reminder state
- Dashboard metrics
- Search results
- Scan history
- Persisted settings
- Backup history

Example:

```ts
export function useProjectsQuery() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: projectGateway.getAll,
    networkMode: "always",
  });
}
```

The `networkMode: "always"` option should be used for local Tauri queries because they do not require internet access.

Cloud queries introduced later should use normal online-aware behavior.

### 5.2 Zustand

Zustand will manage client-side state that is not persisted application data.

Appropriate Zustand state includes:

- Current selected project ID
- Sidebar state
- Active workspace layout
- Global command-palette visibility
- Selected table rows shared across components
- Temporary cross-page filters
- Current onboarding step
- Non-persisted UI preferences

Zustand must not duplicate TanStack Query data.

Avoid:

```ts
const projects = useProjectsQuery();

useEffect(() => {
  projectStore.setProjects(projects.data);
}, [projects.data]);
```

The projects already exist in the TanStack Query cache. Copying them into Zustand creates two sources of truth.

### 5.3 React local state

Use ordinary React state for state owned by one component or one small component tree:

- Dialog open state
- Input values before submission
- Hover state
- Temporary sorting selection
- Accordion state
- Drag-over indicators
- Preview state

Do not place every state value in Zustand.

### 5.4 Axios

Axios will not be required for the offline MVP unless Devventory calls an external HTTP API.

Do not use Axios to wrap Tauri commands:

```ts
// Do not do this
axios.get("tauri://get-projects");
```

Local operations should use Tauri IPC:

```ts
invoke<Project[]>("get_projects");
```

Axios should be introduced when Devventory adds a concrete HTTP responsibility, such as:

- Cloud synchronization endpoints
- Supabase Edge Functions
- Custom REST services
- Update metadata services
- Verified external integrations

Phase 8 Agent Usage does not automatically require Axios. Local coding-agent integrations should remain behind Rust connector adapters when that is the safer fit. If Codex verifies that a provider's supported integration is an HTTP API and a frontend HTTP client is appropriate, Axios may be introduced for that verified connector. Do not install it only in anticipation of possible integrations.

Future structure:

```text
shared/infrastructure/http/
├── axios-client.ts
├── http-error.ts
└── interceptors.ts
```

When using the Supabase JavaScript client directly for authentication or database operations, Axios should not be added around it unnecessarily.

### 5.5 Zod

Zod will validate data crossing application boundaries, such as:

- Rust command responses
- Imported JSON backups
- User-created validation rules
- Cloud API responses
- Application configuration
- Form submissions

Example:

```ts
export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  rootPath: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;
```

### 5.6 React Hook Form

React Hook Form should manage larger forms such as:

- Project creation
- Watched-location configuration
- Asset import
- Environment creation
- Environment-rule configuration
- Coding-agent account and quota-window forms
- Settings
- Restore-backup confirmation

Zod schemas should be connected through the Zod resolver so validation logic is not rewritten manually inside components.

### 5.7 TanStack Table

TanStack Table is recommended for:

- File inventory
- Asset inventory
- Environment matrix
- Validation issues
- Coding-agent accounts and quota windows when a table is the clearest presentation
- Scan history
- Search results

Table definitions should remain inside their respective features.

For example:

```text
features/file-inventory/
└── components/
    └── file-table/
        ├── FileTable.tsx
        ├── file-columns.tsx
        ├── FileTableToolbar.tsx
        └── FileTablePagination.tsx
```

### 5.8 dnd-kit

dnd-kit should be used for internal interface interactions such as:

- Reordering environments
- Reordering watched locations
- Reordering dashboard widgets
- Moving assets between logical categories
- Sorting project presets
- Reordering environment rules

It should not be the only mechanism for importing files from Windows Explorer.

Operating-system file drops should be handled through the Tauri window or filesystem integration. dnd-kit should handle sorting and moving items already represented inside the React interface.

Every sortable interface must provide:

- Keyboard controls
- Visible drag handles
- Screen-reader announcements
- Non-drag alternatives where practical
- Stable unique identifiers

### 5.9 Recharts

Recharts will be used for meaningful dashboard visualizations, not decorative charts.

Suitable visualizations include:

- Files by category
- Validation issues by severity
- Environment-key coverage
- Project scan activity
- Managed versus discovered assets
- File additions over time
- Missing-file trends

Charts must consume prepared view models rather than raw SQLite rows.

```ts
interface FileCategoryMetric {
  category: string;
  count: number;
}
```

The Rust or application service layer should calculate the metric. The chart component should only render it.

---

## 6. Frontend Folder Structure

```text
devventory/
├── src/
│   ├── app/
│   │   ├── providers/
│   │   │   ├── AppProviders.tsx
│   │   │   ├── QueryProvider.tsx
│   │   │   └── ThemeProvider.tsx
│   │   ├── router/
│   │   │   ├── AppRouter.tsx
│   │   │   └── routes.tsx
│   │   ├── layouts/
│   │   │   ├── AppLayout.tsx
│   │   │   └── ProjectLayout.tsx
│   │   ├── errors/
│   │   │   └── AppErrorBoundary.tsx
│   │   └── App.tsx
│   │
│   ├── features/
│   │   ├── projects/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── schemas/
│   │   │   ├── stores/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   ├── tests/
│   │   │   └── index.ts
│   │   │
│   │   ├── project-onboarding/
│   │   ├── file-inventory/
│   │   ├── file-watcher/
│   │   ├── asset-library/
│   │   ├── asset-import/
│   │   ├── environment-tracker/
│   │   ├── environment-comparison/
│   │   ├── validation-center/
│   │   ├── agent-usage/
│   │   ├── global-search/
│   │   ├── dashboard/
│   │   ├── backup-restore/
│   │   └── settings/
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── feedback/
│   │   │   └── layout/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── constants/
│   │   └── infrastructure/
│   │       ├── tauri/
│   │       │   ├── invoke-client.ts
│   │       │   ├── event-client.ts
│   │       │   └── tauri-error.ts
│   │       ├── query/
│   │       │   ├── query-client.ts
│   │       │   └── query-errors.ts
│   │       └── http/
│   │           ├── axios-client.ts
│   │           └── http-error.ts
│   │
│   ├── test/
│   │   ├── fixtures/
│   │   ├── mocks/
│   │   ├── render.tsx
│   │   └── setup.ts
│   │
│   ├── main.tsx
│   └── index.css
│
├── e2e/
│   ├── fixtures/
│   ├── pages/
│   └── specs/
│
├── src-tauri/
├── package.json
├── playwright.config.ts
├── vitest.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## 7. Recommended Feature Structure

A feature does not need every possible folder. Create only the folders it actually needs.

Example:

```text
features/environment-tracker/
├── components/
│   ├── EnvironmentMatrix.tsx
│   ├── EnvironmentKeyRow.tsx
│   ├── EnvironmentSelector.tsx
│   └── EnvironmentStatusBadge.tsx
├── pages/
│   └── EnvironmentTrackerPage.tsx
├── queries/
│   ├── environment.keys.ts
│   ├── environment.queries.ts
│   └── environment.mutations.ts
├── services/
│   ├── environment.gateway.ts
│   └── environment.mapper.ts
├── schemas/
│   ├── environment.schema.ts
│   └── environment-rule.schema.ts
├── stores/
│   └── environment-ui.store.ts
├── types/
│   └── environment.types.ts
├── utils/
│   ├── build-environment-matrix.ts
│   └── get-key-status.ts
├── tests/
│   ├── EnvironmentMatrix.test.tsx
│   └── build-environment-matrix.test.ts
└── index.ts
```

### Folder responsibilities

#### `components/`

Feature-specific presentational components.

Components should not directly:

- Execute SQL
- Call Axios
- Invoke Rust commands
- Contain environment-comparison algorithms
- Mutate global state without using a feature hook

#### `pages/`

Route-level compositions.

Pages may combine feature components and queries but should avoid containing detailed business logic.

#### `queries/`

TanStack Query keys, query hooks, and mutation hooks.

```ts
export const environmentKeys = {
  all: ["environments"] as const,
  byProject: (projectId: string) =>
    [...environmentKeys.all, "project", projectId] as const,
  matrix: (projectId: string) =>
    [...environmentKeys.byProject(projectId), "matrix"] as const,
};
```

#### `services/`

Boundary adapters and data mapping.

For the MVP, services call Tauri commands:

```ts
export const environmentGateway = {
  getMatrix(projectId: string) {
    return invokeValidated(
      "get_environment_matrix",
      { projectId },
      environmentMatrixSchema,
    );
  },
};
```

In the future, a separate cloud gateway may be added:

```text
services/
├── environment.local-gateway.ts
├── environment.cloud-gateway.ts
└── environment.mapper.ts
```

#### `schemas/`

Runtime Zod schemas.

#### `stores/`

Feature-specific Zustand UI stores only when the state must be shared across multiple components.

#### `types/`

Types that cannot be inferred directly from Zod schemas.

#### `utils/`

Pure feature-specific functions.

Avoid vague files such as:

```text
helpers.ts
utils.ts
common.ts
misc.ts
```

Use names that describe one responsibility:

```text
compare-environment-keys.ts
normalize-environment-key.ts
build-environment-matrix.ts
```

#### `tests/`

Tests remain close to the feature they verify.

---

## 8. Rust Feature-Based Structure

```text
src-tauri/
├── capabilities/
│   ├── default.json
│   └── filesystem.json
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_environment_tracker.sql
│   └── 0003_search_index.sql
├── src/
│   ├── app/
│   │   ├── bootstrap.rs
│   │   ├── state.rs
│   │   └── mod.rs
│   │
│   ├── features/
│   │   ├── projects/
│   │   │   ├── commands.rs
│   │   │   ├── service.rs
│   │   │   ├── repository.rs
│   │   │   ├── models.rs
│   │   │   ├── dto.rs
│   │   │   ├── errors.rs
│   │   │   ├── tests.rs
│   │   │   └── mod.rs
│   │   │
│   │   ├── file_index/
│   │   │   ├── commands.rs
│   │   │   ├── scanner.rs
│   │   │   ├── watcher.rs
│   │   │   ├── exclusion.rs
│   │   │   ├── repository.rs
│   │   │   ├── models.rs
│   │   │   ├── dto.rs
│   │   │   └── mod.rs
│   │   │
│   │   ├── assets/
│   │   │   ├── commands.rs
│   │   │   ├── importer.rs
│   │   │   ├── duplicate_detector.rs
│   │   │   ├── repository.rs
│   │   │   ├── dto.rs
│   │   │   └── mod.rs
│   │   │
│   │   ├── environments/
│   │   │   ├── commands.rs
│   │   │   ├── parser.rs
│   │   │   ├── comparison.rs
│   │   │   ├── validation.rs
│   │   │   ├── repository.rs
│   │   │   ├── models.rs
│   │   │   ├── dto.rs
│   │   │   └── mod.rs
│   │   │
│   │   ├── agent_usage/
│   │   ├── search/
│   │   ├── dashboard/
│   │   ├── backups/
│   │   └── settings/
│   │
│   ├── shared/
│   │   ├── database/
│   │   │   ├── connection.rs
│   │   │   ├── migrations.rs
│   │   │   └── mod.rs
│   │   ├── filesystem/
│   │   │   ├── paths.rs
│   │   │   ├── permissions.rs
│   │   │   └── mod.rs
│   │   ├── events/
│   │   ├── errors/
│   │   ├── telemetry/
│   │   └── validation/
│   │
│   ├── lib.rs
│   └── main.rs
├── Cargo.toml
└── tauri.conf.json
```

---

## 9. Rust Separation of Concerns

### 9.1 Commands

Tauri commands are boundary functions.

They should:

1. Receive a DTO.
2. Perform basic boundary validation.
3. Call an application service.
4. Convert application errors into serializable errors.
5. Return a DTO.

They should not contain:

- Raw SQL
- Large parsing algorithms
- Filesystem traversal logic
- Environment comparison logic
- Chart aggregation logic

```rust
#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectRequest,
) -> Result<ProjectResponse, CommandError> {
    let project = state
        .project_service
        .create(input)
        .await?;

    Ok(ProjectResponse::from(project))
}
```

### 9.2 Services

Services coordinate use cases.

Examples:

- Create a project
- Scan a project
- Import an asset
- Parse an environment file
- Compare environments
- Track a coding-agent quota window
- Synchronize a verified coding-agent connector
- Create a backup

A service may use multiple repositories or infrastructure adapters.

### 9.3 Repositories

Repositories handle persistence.

```rust
pub trait ProjectRepository {
    async fn create(
        &self,
        project: NewProject,
    ) -> Result<Project, ProjectError>;

    async fn find_all(
        &self,
    ) -> Result<Vec<Project>, ProjectError>;
}
```

SQL must remain inside repository implementations.

### 9.4 Domain logic

Pure logic should remain separate from Tauri, SQL, and filesystem access.

Examples:

- Environment-key comparison
- Key-name normalization
- Validation-rule evaluation
- File category detection
- Exclusion matching

Pure logic is easier to unit test.

### 9.5 DTOs and models

Separate:

```text
Database model
Domain model
Command request DTO
Command response DTO
Frontend view model
```

Do not expose raw database rows directly to React.

---

## 10. Application Data Flow

The standard data flow will be:

```text
React component
      ↓
Feature query or mutation hook
      ↓
Feature gateway
      ↓
Tauri invoke
      ↓
Rust command
      ↓
Rust service
      ↓
Repository or filesystem adapter
      ↓
SQLite or project filesystem
```

The response returns through the same boundary:

```text
SQLite/domain model
      ↓
Rust response DTO
      ↓
Zod validation
      ↓
TanStack Query cache
      ↓
React component
```

### Example mutation flow

```ts
export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectGateway.create,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.all,
      });
    },
  });
}
```

Do not manually update multiple components after a mutation. Invalidate or update the relevant query cache.

---

## 11. Core Features

### 11.1 Project onboarding

The user can:

- Create a project record
- Select a local project root
- Name and describe the project
- Choose project type
- Configure watched folders
- Configure environment files
- Review default exclusions
- Run an initial scan

Default exclusions:

```text
node_modules/
.git/
.next/
dist/
build/
target/
coverage/
.cache/
.turbo/
```

### 11.2 Project dashboard

Display:

- Total indexed files
- Managed asset count
- Environment count
- Environment-key count
- Active validation issues
- Watched-location status
- Last scan time
- Recently added files
- Missing files
- Scan activity

Recharts may display:

- Files by category
- Environment coverage
- Issues by severity
- Recent scan changes

### 11.3 File indexing

The scanner collects:

- Name
- Relative path
- Extension
- MIME type
- Size
- Last modified timestamp
- File category
- Source type
- Optional hash

The file watcher detects:

- Created files
- Modified files
- Deleted files
- Renamed files
- Moved files

Events must be debounced because editors and operating systems may emit multiple events for one logical operation.

### 11.4 Reconciliation scans

Watchers cannot detect changes made while Devventory is closed.

Devventory must support:

- Startup reconciliation
- Manual re-scan
- Watched-location re-scan
- Full project re-scan
- Missing-file recovery
- Root-path relocation

### 11.5 Asset library

Users can:

- Browse assets
- Filter by type
- Add tags
- Add notes
- Mark favorites
- Open files
- Open containing folders
- Copy relative paths
- Copy absolute paths
- Open files in VS Code
- Group asset variants
- Detect duplicate imported files

### 11.6 Asset import

Users can:

1. Select or drop a file.
2. Preview file metadata.
3. Select a destination inside the project.
4. Rename the file.
5. Add tags and notes.
6. Copy the file.
7. Index the result.

Collision handling:

- Cancel
- Replace
- Keep both
- Rename before import

All destination paths must be validated to prevent writing outside the approved project root.

### 11.7 Environment tracker

Users can create custom environments:

- Local
- Development
- Testing
- Staging
- Production

Each environment may contain one or more source files.

Devventory will display a matrix:

| Key | Local | Development | Staging | Production |
|---|---:|---:|---:|---:|
| `SUPABASE_URL` | Present | Present | Present | Present |
| `STRIPE_TEST_KEY` | Present | Present | Present | Forbidden |
| `STRIPE_LIVE_KEY` | Missing | Missing | Missing | Present |

### 11.8 Environment validation

Supported validation states:

- Present
- Missing
- Duplicate
- Unexpected
- Forbidden
- Case mismatch
- Invalid name
- Commented out
- Source unreadable

Rules:

- Required
- Optional
- Forbidden

Devventory must not claim that a key is incorrectly placed unless the user or a project template defines a placement rule.

### 11.9 Environment sorting

dnd-kit may be used to reorder:

- Environment columns
- Validation rules
- Source-file priority
- Key groups

The updated order must be persisted through a TanStack Query mutation.

### 11.10 Agent Usage and coding-agent availability

Agent Usage is a global module. It must remain visible and consistent regardless of which development project is selected.

The module answers three primary questions:

1. Which coding-agent account can I use now?
2. Which unavailable account resets next?
3. Which accounts are approaching a reset or have reset today?

Built-in platform choices should initially include:

```text
Codex
Claude Code
Devin
GitHub Copilot
Cursor
Kiro
Antigravity
Gemini CLI
Windsurf
Other / Custom
```

The built-in list is a convenience, not a restriction. `Other / Custom` must allow manual tracking for coding agents that Devventory does not know about yet.

#### Account identity

Each account should contain:

- Coding-agent platform
- Sign-in method
- Full account identifier
- Tracking mode: manual or automatic when a verified connector exists
- Default timezone, initially `Asia/Manila`
- Optional account note only if a real use case is later identified

Do not require a paid plan. Free-plan accounts must work the same way in manual tracking.

Do not require or store:

- Passwords
- API-key values merely for account labeling
- Browser cookies
- OAuth refresh tokens copied from another application
- Coding-agent session tokens
- Provider credentials that are not explicitly required by a verified connector

#### Quota windows

One account may have one or more quota windows because coding-agent providers may expose multiple independent limits.

Examples:

```text
5-hour
Daily
Weekly
Monthly
Credits
Other
```

A quota window may contain:

- Label or window type
- Optional usage remaining percentage
- Reset date and time
- Timezone
- Availability state
- Tracking source
- Last updated timestamp

Usage remaining is optional. Reset tracking must still work when no percentage is known.

If an automatic connector reports `usedPercent`, Devventory may derive `remainingPercent = 100 - usedPercent` for presentation as long as the provider's semantics are verified.

If multiple quota windows can independently block an account, the account should remain unavailable while any known blocking quota is still exhausted.

When a manually tracked reset timestamp is reached:

- Treat that quota window as reset/available.
- Do not require a separate "Confirm Available" action.
- Do not automatically assume a new remaining percentage.
- Mark the previous usage snapshot stale, unknown, or cleared until the user updates it or a connector refreshes it.

#### Reset-date input

Support three reset-entry methods:

1. **Exact date/time**
   - Calendar date picker
   - Time picker
   - Timezone

2. **Relative reset**
   - `Reset in` days, hours, and minutes
   - Compute the absolute reset timestamp from the current time

3. **Paste reset information**
   - Accept a pasted date, timestamp, or provider message
   - Parse common formats such as an ISO timestamp, `Friday at 3:00 PM`, `August 14 at 3 PM`, or `reset in 6 days and 4 hours`
   - Show the detected date/time and timezone before saving
   - Do not use the word `ago` for future relative resets unless the pasted text itself explicitly refers to the past

Natural-language parsing should be deterministic where practical. AI is not required for the MVP.

#### Availability and reminders

Useful states may include:

```text
Available
Limited
Exhausted
Reset soon
Unknown
```

The exact state model should be kept small and based on known data.

Devventory should surface:

- Available accounts
- Accounts with low optional remaining usage
- Exhausted accounts
- Next reset across accounts
- Resets occurring tomorrow
- Resets occurring today
- Reset timestamps that have just elapsed

Support native or in-app reminders for:

- One day before reset
- Reset day
- Reset time reached

Reminder behavior must not require a provider connector.

#### Tracking source and freshness

Every usage/reset value should record its source where practical:

```text
Manual
Pasted message
Automatic connector
```

For manually entered usage, the UI should describe the value as a reported or last-updated snapshot rather than pretending it is continuously live.

Example:

```text
30% remaining
Updated 2 hours ago
Source: Manual
```

#### Automatic connector verification gate

Automatic connector support must be decided during Phase 8 implementation after Codex independently verifies current official documentation and supported local/API interfaces.

Earlier product research found the following leads. These are **research notes, not implementation guarantees**:

- **Codex** — appeared to expose structured current-account and rate-limit/reset information through a local Codex App Server or related supported interface. Strong candidate for automatic account, usage, reset, and multiple-window synchronization.
- **Claude Code** — appeared to expose structured authentication/account information and structured rate-limit data in supported local interfaces, but with plan/session limitations. Candidate for automatic or partial synchronization after verification.
- **Devin** — official usage/consumption/limit APIs appeared to exist for some plans, organizations, or enterprise contexts. Treat as a possible API connector, not a guaranteed local CLI quota connector.
- **GitHub Copilot** — official GitHub billing/usage APIs appeared to expose AI-credit or Copilot-related usage for some personal, organization, or enterprise contexts. Reset semantics may differ from short-lived rate limits. Candidate API connector after verification.
- **Cursor** — local CLI appeared capable of identifying the authenticated account, while usage automation appeared stronger for Teams/Enterprise/admin APIs than individual plans. Candidate partial connector.
- **Kiro** — CLI appeared to provide structured account identity and an interactive usage view, but a stable machine-readable quota command was not confirmed. Candidate partial connector.
- **Antigravity** — no stable structured account/quota/reset interface was confirmed. Manual tracking is the baseline.
- **Gemini CLI** — Google API/project quota systems exist, but they are not necessarily equivalent to consumer Gemini CLI allowances. Manual or partial tracking until verified.
- **Windsurf** — no stable structured connector was confirmed in the earlier research. Manual tracking until verified.
- **Other / Custom** — manual tracking.

Codex must re-check these findings against current official documentation and the current installed tool versions before implementation. The real connector matrix must be based on that verification, not on this planning document alone.

For each provider, classify verified capabilities such as:

```text
Account detection
Usage synchronization
Reset synchronization
Multiple quota windows
Required local installation
Required network access
Required user-provided API credential
Plan/account limitations
```

Implement only connectors that have a stable, supportable integration surface.

Do not implement connectors by:

- Scraping private web dashboards
- Depending on undocumented private endpoints
- Reading browser cookies
- Copying provider OAuth/session tokens from unrelated applications
- Modifying provider account files to switch accounts
- Parsing unstable decorative terminal output when a supported structured interface is unavailable

When a connector cannot be verified, keep the provider manual.

#### Connector architecture

If one or more connectors are verified, isolate them behind a feature-local connector boundary rather than scattering provider-specific conditionals across the application.

Conceptually:

```text
Agent Usage service
      ↓
Agent connector interface
      ↓
Codex / Claude / Copilot / other verified adapters
```

Each connector should expose only the capabilities it actually supports.

Manual tracking remains the universal fallback and source of truth for unsupported providers.

### 11.11 Global search

Search:

- File names
- Relative paths
- Extensions
- Categories
- Tags
- Notes
- Environment key names
- Project names

Filters:

- Project
- File category
- Extension
- Tag
- Environment
- File status
- Managed or discovered
- Modified date

Search should be performed by the Rust and SQLite layer rather than loading the complete database into React.

### 11.12 Backup and restore

Support:

- Metadata database backup
- Backup verification
- Restore preview
- Automatic pre-migration backup
- Project metadata export
- Environment manifest export

Example safe manifest:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SMTP_HOST=
SMTP_PORT=
```

---

## 12. Database Ownership

Each feature owns its related tables conceptually, but all migrations remain in one ordered migration directory.

| Feature | Tables |
|---|---|
| Projects | `projects`, `watched_locations` |
| File inventory | `indexed_files`, `scan_runs` |
| Asset library | `file_tags`, `file_notes`, `asset_relations` |
| Environment tracker | `environments`, `environment_sources`, `environment_key_definitions`, `environment_key_occurrences` |
| Validation center | `environment_key_rules`, `validation_issues` |
| Agent Usage | `agent_platforms`, `agent_accounts`, `agent_quota_windows`, `agent_usage_snapshots`, `agent_reminders` as actually needed |
| Search | SQLite search-index or FTS tables |
| Settings | `application_settings` |
| Backup | `backup_records` |
| Future sync | `sync_queue`, `devices`, synchronization columns |

Recommended shared columns:

```text
id
created_at
updated_at
deleted_at
revision
sync_status
remote_id
```

Use UUIDs for identifiers so records can later synchronize without relying on device-specific incrementing IDs.

---

## 13. Error Handling

### Frontend errors

Create typed error categories:

```text
ValidationError
CommandError
FilesystemError
DatabaseError
PermissionError
ConflictError
NetworkError
UnknownError
```

TanStack Query errors should be normalized before they reach components.

Components should receive understandable information:

```ts
interface AppError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}
```

### Rust errors

Use feature-specific error enums and `thiserror`.

```rust
#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    #[error("Project folder does not exist")]
    FolderNotFound,

    #[error("Project folder cannot be read")]
    FolderUnreadable,

    #[error("Database operation failed")]
    Database,
}
```

Avoid returning raw internal database errors directly to the interface.

### Logging

Never log:

- Environment values
- Authentication tokens
- Coding-agent OAuth/session tokens or browser cookies
- Provider API credentials unless explicitly redacted and required by a verified connector
- Encryption keys
- Supabase secrets
- File contents unless explicitly approved

Structured logs should contain identifiers and operation details rather than sensitive content.

---

## 14. Clean-Code Requirements

### 14.1 Single responsibility

Each module should have one clear reason to change.

Avoid:

```text
environment-utils.ts
```

containing parsing, formatting, validation, API calls, and UI helpers.

Prefer:

```text
parse-environment-file.rs
normalize-environment-key.rs
compare-environment-keys.rs
format-environment-label.ts
```

### 14.2 No raw infrastructure calls in components

React components must not directly call:

- `invoke()`
- Axios
- SQLite
- Filesystem plugins
- Supabase
- Rust event listeners

Use feature gateways and hooks.

### 14.3 No raw SQL in commands

All SQL belongs in repositories.

### 14.4 Avoid premature abstraction

Do not create generic abstractions before a real repeated use case exists.

A small duplicated formatting expression may be preferable to an unclear shared helper.

### 14.5 Avoid generic shared components

Avoid components such as:

```text
UniversalManager
GenericDataHandler
DynamicEverythingTable
```

Prefer components with clear behavior and business meaning.

### 14.6 Prefer composition

Build larger interfaces from smaller components rather than creating components with dozens of boolean props.

Avoid:

```tsx
<FileCard
  searchable
  editable
  compact
  sortable
  environmentMode
  dashboardMode
  importMode
/>
```

Prefer composed variants:

```tsx
<AssetCard />
<SearchResultRow />
<ImportPreviewCard />
```

### 14.7 No duplicated business rules

Environment comparison must have one domain implementation.

Do not independently implement comparison in:

- React
- Rust
- Dashboard code
- Export code

The Rust domain service should calculate the authoritative comparison result. React should render it.

### 14.8 Explicit naming

Prefer:

```ts
getMissingEnvironmentKeys()
```

over:

```ts
processData()
```

Prefer:

```rust
scan_watched_location()
```

over:

```rust
handle_files()
```

### 14.9 Small public APIs

Features should export only what other features need.

### 14.10 Type safety

- Avoid `any`.
- Validate unknown data.
- Use discriminated unions for UI states.
- Use enums or constrained string unions for statuses.
- Use Rust enums instead of unvalidated string status values internally.

### 14.11 Provider connector boundaries

Coding-agent integrations must remain behind the Agent Usage feature boundary.

Avoid provider checks scattered across commands, components, and repositories:

```rust
if provider == "codex" { ... }
else if provider == "claude" { ... }
```

Prefer a connector interface or equivalent capability-oriented boundary when automatic connectors are actually implemented.

The connector abstraction must reflect verified current needs. Do not create a large generic plugin framework before at least one real connector requires it.

---

## 15. Testing Strategy

### 15.1 Rust unit tests

Test pure domain logic:

- Environment parsing
- Duplicate-key detection
- Key normalization
- Environment comparison
- Validation rules
- Exclusion matching
- File categorization
- Path validation
- Collision naming
- Hash comparison
- Agent quota reset calculations
- Agent availability calculation across multiple quota windows
- Relative reset-date calculation
- Deterministic pasted reset-date parsing

### 15.2 Rust integration tests

Test:

- SQLite repositories
- Database migrations
- Scan persistence
- Asset-import transactions
- Backup creation
- Restore operations
- Watched-location reconciliation
- Agent account and quota-window persistence
- Reminder scheduling state
- Verified connector adapters with mocked provider processes or HTTP responses

Use temporary directories and temporary SQLite databases.

Live coding-agent accounts and real provider credentials must not be required for automated tests.

### 15.3 Frontend unit tests

Use Vitest and React Testing Library for:

- Components
- Query hooks
- Zustand stores
- Zod schemas
- View-model functions
- Environment matrix rendering
- Search filters
- Validation indicators
- Agent Usage account/quota rendering
- Reset-date input and reminder states
- Connector capability rendering
- Drag-and-drop state transformations

### 15.4 Contract tests

Mock Tauri command responses and verify that:

- Zod accepts valid command responses.
- Zod rejects invalid responses.
- Gateways normalize errors.
- Agent connector DTOs reject malformed or unsafe provider data.
- Query hooks invalidate the correct cache keys.

### 15.5 Playwright tests

Playwright should test the React application through a browser-compatible test mode with mocked Tauri commands.

Test flows such as:

- Project onboarding
- Asset filtering
- Environment comparison
- Validation-rule creation
- Manual coding-agent account and quota tracking
- Reset-date entry and reminder states
- Search
- Backup confirmation
- Sorting environment columns
- Error and empty states

### 15.6 Native Tauri end-to-end tests

Playwright alone should not be considered complete validation of native Tauri behavior.

Use WebdriverIO with Tauri support for native smoke tests such as:

- Opening the real desktop application
- Selecting a project directory
- Calling real Rust commands
- Reading and indexing test files
- Importing a real test asset
- Confirming SQLite persistence
- Restarting the application
- Confirming data remains available
- Confirming manually tracked Agent Usage data survives restart

The testing layers will therefore be:

```text
Rust unit tests
        ↓
Rust repository integration tests
        ↓
Vitest frontend tests
        ↓
Playwright browser-mode workflows
        ↓
WebdriverIO native Tauri smoke tests
```

---

## 16. Continuous Integration

Every pull request must run:

### Frontend checks

```text
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

### Rust checks

```text
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo check
```

### Additional checks

- Commit-message validation
- Migration validation
- Dependency audit
- Tauri build verification
- No committed environment files containing values
- No accidental large binary files
- No feature-boundary violations

Native Tauri build jobs may run on Windows, Linux, and macOS once cross-platform releases are introduced.

---

## 17. Semantic Versioning and Automated Releases

Devventory will use:

- Semantic Versioning
- Conventional Commits
- semantic-release
- GitHub Actions
- GitHub Releases
- Tauri Action

### 17.1 Version meanings

```text
MAJOR.MINOR.PATCH
```

Examples:

```text
1.0.0
1.1.0
1.1.1
2.0.0
```

#### Patch

Bug fixes that do not introduce breaking behavior:

```text
fix(scanner): handle unreadable directories
```

Result:

```text
1.2.0 → 1.2.1
```

#### Minor

Backward-compatible features:

```text
feat(environments): add production-only key rules
```

Result:

```text
1.2.1 → 1.3.0
```

#### Major

Breaking changes:

```text
feat(database)!: replace project metadata format
```

or:

```text
BREAKING CHANGE: Existing project metadata must be migrated.
```

Result:

```text
1.3.0 → 2.0.0
```

### 17.2 Commit format

```text
type(scope): description
```

Recommended types:

```text
feat
fix
perf
refactor
docs
test
build
ci
chore
style
revert
```

Recommended scopes:

```text
projects
scanner
watcher
assets
environments
agent-usage
connectors
search
dashboard
backup
settings
database
release
ui
```

Examples:

```text
feat(assets): add duplicate file detection
fix(environments): ignore commented key declarations
refactor(scanner): separate exclusion matching service
test(search): add metadata filtering tests
ci(release): configure semantic release workflow
```

### 17.3 Commit validation

Use:

- Husky
- commitlint
- lint-staged

Local workflow:

```text
Developer creates commit
        ↓
commitlint validates message
        ↓
lint-staged checks changed files
        ↓
Commit succeeds
```

Pull requests should use squash merging so the final commit follows Conventional Commits.

### 17.4 Version source of truth

The root `package.json` should be the application-version source of truth.

Configure Tauri to read its version from that file:

```json
{
  "version": "../package.json"
}
```

This prevents manually maintaining separate app versions in:

```text
package.json
tauri.conf.json
Cargo.toml
```

The Rust crate version in `Cargo.toml` may remain an internal crate version unless the team decides it must match the desktop application version.

### 17.5 Semantic-release configuration

Recommended plugins:

```text
@semantic-release/commit-analyzer
@semantic-release/release-notes-generator
@semantic-release/changelog
@semantic-release/npm
@semantic-release/git
@semantic-release/github
```

For a private desktop application package:

```json
[
  "@semantic-release/npm",
  {
    "npmPublish": false
  }
]
```

Example configuration:

```json
{
  "branches": ["main"],
  "tagFormat": "v${version}",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": [
          "package.json",
          "package-lock.json",
          "CHANGELOG.md"
        ],
        "message": "chore(release): ${nextRelease.version} [skip ci]"
      }
    ],
    "@semantic-release/github"
  ]
}
```

### 17.6 Release workflow

```text
Pull request merged into main
        ↓
CI runs all required checks
        ↓
semantic-release analyzes commits
        ↓
Determines next SemVer version
        ↓
Updates package.json and CHANGELOG.md
        ↓
Creates Git tag
        ↓
Creates GitHub Release
        ↓
Tauri build matrix runs
        ↓
Windows, macOS and Linux installers are built
        ↓
Installers are attached to the GitHub Release
```

### 17.7 Release branches

Initial release branch:

```text
main
```

Possible future prerelease branches:

```text
beta
next
```

Examples:

```text
2.0.0-beta.1
2.0.0-beta.2
```

---

## 18. Implementation Phases

### Phase 1: Project foundation

Implement:

- Tauri project
- React and TypeScript
- HeroUI
- Tailwind
- Routing
- App providers
- Feature-first folders
- Shared infrastructure
- Error boundaries
- Query client
- Base Zustand UI store
- ESLint and Prettier
- Vitest
- Playwright
- Conventional Commits
- commitlint
- semantic-release skeleton

Deliverables:

- Native desktop window
- Working navigation
- Light and dark modes
- Test React-to-Rust command
- CI checks
- Feature-boundary documentation

### Phase 2: Rust and SQLite foundation

Implement:

- Application state
- SQLite connection pool
- Versioned migrations
- Repository interfaces
- Shared error system
- Logging
- UUID identifiers
- Backup before migrations

Deliverables:

- Database initialization
- Migration runner
- Typed command errors
- Repository integration tests

### Phase 3: Project onboarding

Implement:

- Project creation
- Native folder picker
- Root-path validation
- Watched-location setup
- Default exclusions
- Initial project scan

Deliverables:

- Persistent project registration
- Project list
- Project details
- Scan summary

### Phase 4: File inventory and watching

Implement:

- File scanner
- Metadata extraction
- File categorization
- File watcher
- Debounced events
- Reconciliation scans
- Missing-file detection

Deliverables:

- Searchable file inventory
- Automatic file-change updates
- Manual re-scan
- Startup reconciliation

### Phase 5: Asset library and import

Implement:

- Asset inventory
- Import dialog
- Operating-system file drop
- Destination selection
- File collision handling
- Tags
- Notes
- Favorites
- Duplicate detection
- Quick file actions

Deliverables:

- Managed asset center
- Import workflow
- Metadata editing
- Asset filters

### Phase 6: Environment tracker

Implement:

- Custom environments
- Environment source files
- Environment parser
- Key occurrence storage
- Duplicate detection
- Environment matrix
- dnd-kit column reordering

Deliverables:

- Environment setup
- Environment matrix
- Source-file priority
- Duplicate indicators

### Phase 7: Comparison and validation

Implement:

- Required rules
- Optional rules
- Forbidden rules
- Environment comparison
- Case mismatch detection
- Issue severity
- Resolution state
- `.env.example` export

Deliverables:

- Validation center
- Project environment-health status
- Safe manifest export

### Phase 8: Agent Usage and coding-agent availability

Implement:

- Global Agent Usage module independent of selected projects
- Built-in and custom coding-agent platforms
- Sign-in-method selection
- Full account identifier
- Manual tracking baseline
- One or more quota windows per account
- Optional usage remaining
- Exact reset date/time picker
- Relative `Reset in` days/hours/minutes
- Pasted reset-date/message parser with confirmation
- `Asia/Manila` default timezone using an IANA timezone identifier
- Availability calculation across quota windows
- Reset-soon, tomorrow, today, and reset-time reminders
- Tracking-source and last-updated metadata
- Automatic clearing/staling of old manual usage snapshots after reset without assuming `100%`
- Connector capability verification against current official provider interfaces
- Verified automatic connectors only where a stable supported interface exists
- Manual fallback for every provider

Connector verification inputs from earlier research:

- Codex: strong candidate for local structured account/rate-limit/reset synchronization
- Claude Code: candidate for local structured account/rate-limit synchronization with possible plan/session limitations
- Devin: candidate API connector where official usage/consumption/limit APIs are available
- GitHub Copilot: candidate API connector for supported billing/AI-credit usage contexts
- Cursor: likely partial connector; account detection may be easier than individual usage synchronization
- Kiro: likely partial connector; structured account identity was found but structured quota synchronization was not confirmed
- Antigravity: manual unless Codex verifies a supported structured interface
- Gemini CLI: manual/partial until consumer allowance versus API/project quota behavior is verified
- Windsurf: manual unless Codex verifies a supported structured interface
- Other / Custom: manual

Codex must independently verify the above findings at implementation time and make the final connector-support decision. Do not treat the research notes as authoritative API contracts.

Deliverables:

- Agent/account registry
- Manual usage and reset tracking
- Multiple quota-window support
- Reset-date parsing and computation
- Availability and next-reset view
- Reminder experience
- Connector capability matrix documented from current official sources
- Implemented automatic connectors only for providers Codex verifies as stable and appropriate
- Manual fallback for unsupported or partially supported providers

### Phase 9: Search and dashboard

Implement:

- Global metadata search
- TanStack Table results
- Advanced filters
- Search history
- Dashboard metrics
- Recharts visualizations

Deliverables:

- Global command palette
- Search results
- File-category chart
- Validation-severity chart
- Environment-coverage chart

### Phase 10: Backup, reliability, and release

Implement:

- Database backup
- Restore validation
- Migration backup
- Large-project testing
- Native smoke tests
- Windows installer
- semantic-release production workflow
- GitHub Release artifact upload

Deliverables:

- Stable offline MVP
- Automated versioning
- Installable release
- Recovery documentation

### Phase 11: Future cloud support

Implement later:

- Supabase authentication
- Google login
- Email and password
- Cloud metadata synchronization
- Axios HTTP client for Devventory cloud APIs when needed
- Sync queue
- Device records
- Conflict resolution
- Cloud backup
- Encrypted secret storage

---

## 19. MVP Dependency Decisions

### Include in the MVP

```text
Tauri
React
TypeScript
Rust
SQLite
SQLx
HeroUI
Tailwind CSS
TanStack Query
Zustand
Zod
React Hook Form
TanStack Table
dnd-kit
Recharts
Vitest
React Testing Library
Playwright
WebdriverIO Tauri service
semantic-release
commitlint
Husky
lint-staged
ESLint
Prettier
```

### Conditional Phase 8 integration dependencies

Do not preinstall provider integration libraries.

During Phase 8, Codex must first verify each candidate connector against current official documentation and the actual supported interface.

A verified connector may justify adding:

```text
A Rust process/IPC dependency for a documented local CLI or app-server interface
A Rust HTTP client or Axios when an official provider API is the chosen boundary
A Tauri notification capability for reset reminders
Provider-specific parsing/transport dependencies only when required
```

Prefer existing Rust/Tauri capabilities when they already satisfy the use case. Do not install a generic connector framework.

### Delay until Devventory cloud functionality

```text
Supabase JavaScript client
Supabase Authentication
Supabase Storage
Cloud synchronization dependencies
Encryption synchronization tools
```

Axios is not automatically a cloud-only dependency anymore because a verified Phase 8 provider API might justify it. Add Axios only when there is a concrete HTTP responsibility. Avoid installing infrastructure that has no active responsibility.

---

## 20. MVP Completion Criteria

The MVP is complete when a user can:

1. Install Devventory on Windows.
2. Create a project without an account.
3. Select an existing project folder.
4. Configure watched folders and environment files.
5. Scan and index file metadata.
6. Search indexed metadata.
7. Detect files added, modified, moved, or deleted.
8. Import assets into the project.
9. Organize assets with tags and notes.
10. Create multiple environments.
11. Reorder environments.
12. Compare environment key names.
13. Detect duplicate and missing keys.
14. Define required, optional, and forbidden rules.
15. View project-health metrics.
16. Track coding-agent accounts globally without tying them to a project.
17. Identify each coding-agent account using a sign-in method and full account identifier.
18. Track one or more quota windows with an optional usage-remaining value and reset date/time.
19. Enter reset times through a date/time picker, relative `Reset in` input, or pasted date/message.
20. See which coding-agent account is available, which reset is next, and which resets occur today or tomorrow.
21. Use manual Agent Usage tracking for any provider even when no connector exists.
22. Use verified automatic connectors only where current supported provider interfaces allow reliable account/usage/reset synchronization.
23. Back up and restore Devventory metadata.
24. Restart Devventory without losing data.
25. Use all local core features, including manual Agent Usage tracking, without internet access. Automatic provider synchronization may require internet access.
26. Run automated frontend, Rust, and native smoke tests.
27. Generate releases automatically through Semantic Versioning.

---

## 21. Final Architectural Rules

```text
Persisted async data
→ TanStack Query

Cross-feature UI state
→ Zustand

Component-only state
→ React state

Local native operations
→ Tauri commands

Business logic
→ Rust services and pure domain modules

Database access
→ Rust repositories

Runtime frontend validation
→ Zod

Forms
→ React Hook Form

Internal sorting and reordering
→ dnd-kit

Tabular interfaces
→ TanStack Table

Dashboard charts
→ Recharts

Coding-agent provider integrations
→ Feature-local Rust connector adapters using only verified supported interfaces

Future Devventory cloud HTTP APIs
→ Axios through TanStack Query when a concrete frontend HTTP responsibility exists

Frontend unit tests
→ Vitest and React Testing Library

Browser-mode workflows
→ Playwright

Real native desktop smoke tests
→ WebdriverIO Tauri service

Application versioning
→ semantic-release and Conventional Commits
```

The central dependency direction must remain:

```text
Presentation
     ↓
Application hooks and use cases
     ↓
Feature gateways
     ↓
Tauri commands
     ↓
Rust services
     ↓
Repositories and infrastructure
```

Infrastructure must never control the product architecture. Features define the application, while React, Tauri, SQLite, Axios, provider CLIs, provider APIs, and other libraries remain replaceable implementation details.

Agent Usage must remain functional without connectors. Provider integrations enhance the feature; they do not define its domain model.
