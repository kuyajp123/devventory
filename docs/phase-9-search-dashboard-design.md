# Phase 9 search and dashboard design

## Boundaries

Phase 9 reads Devventory-owned metadata created by Phases 2–7. It does not read
project file contents, environment values, credentials, Agent Usage identifiers,
or provider session data. Agent Usage remains global and is present only as a
command-palette navigation destination.

The implemented dependency directions are:

```text
Search UI -> TanStack Query -> typed gateway -> Tauri command
          -> Rust search service -> search repository -> SQLite

Dashboard UI -> TanStack Query -> typed gateway -> Tauri command
             -> Rust dashboard service -> aggregate repository -> SQLite
```

## Search decisions

1. **Strategy — normalized SQLite queries, not FTS5.** The existing normalized
   tables already own all searchable metadata, have project/category/status/path/
   extension indexes, and are updated transactionally by their feature
   repositories. FTS5 would require triggers or explicit synchronization across
   project reconciliation, asset metadata, environment parsing, and deletion.
   For the current local dataset, parameterized `instr(lower(...), lower(?))`
   queries keep the implementation recoverable and avoid a second index that can
   drift. A representative constrained page query is checked with
   `EXPLAIN QUERY PLAN` in the Rust tests. SQLite contains matching can still scan
   the rows inside a broad scope, so measured slowdown on much larger databases
   is the threshold for reconsidering FTS5. See [SQLite query planning](https://www.sqlite.org/queryplanner.html)
   and [FTS5 external-content synchronization](https://www.sqlite.org/fts5.html#external_content_tables).

2. **Matching.** Query text is trimmed and matched as a case-insensitive ASCII
   substring against project names, file names, project-relative paths,
   extensions, categories, asset tag names, asset notes, and environment-key
   names. SQLite's built-in `lower()` does not provide full Unicode case folding;
   Unicode text is still searchable using SQLite's native matching semantics.
   Extensions and tag filters are lowercased before querying. SQL-looking text,
   `%`, and `_` are ordinary characters because the query uses bound values and
   `instr`, not interpolated `LIKE` patterns.

3. **Ranking and ordering.** Relevance orders exact names, name prefixes,
   path matches, then other metadata matches. The secondary order is name,
   result type, environment name, and stable UUID. Name, project, and modified
   sorting map validated enums to static SQL fragments; user strings never enter
   `ORDER BY`.

4. **Pagination.** Search uses backend page-number pagination, defaults to 25
   rows, rejects page sizes above 100, returns the total count and page count,
   and transfers only the requested page to React. TanStack Table uses manual
   sorting and pagination, following its installed v9 feature APIs.

5. **History.** Only explicit executions and restored searches are recorded;
   debounced keystrokes are not. Empty unfiltered requests are ignored. Identical
   request JSON is moved to the newest position. SQLite retains at most 20 rows,
   supports individual deletion and clear-all, and cascades project-scoped
   entries when a project is deleted.

6. **Result DTO.** A discriminated union returns `project`, `file`, or
   `environment_key`. Managed files remain one file result with `origin:
   managed`, avoiding duplicate physical-file results. The DTO exposes only the
   fields needed to render and navigate to existing feature routes.

7. **Synchronization and recovery.** There is no materialized search index to
   rebuild. Every query reads the authoritative normalized tables. Earlier
   feature mutations and runtime change events narrowly invalidate global-search
   queries, so reopening or refreshing search always reconciles from SQLite.

TanStack Query keys include the complete validated request as recommended by
the [official query-key guidance](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).
SQL is assembled with bound values through [SQLx `QueryBuilder`](https://docs.rs/sqlx/latest/sqlx/struct.QueryBuilder.html).

## Dashboard decisions

The active-project dashboard uses one Tauri command. Its repository opens a
consistent SQLite read transaction and runs a small fixed set of aggregate
queries for metrics, categories, open issue severities, environment coverage,
and the eight most recent scans. No raw file, issue, or occurrence collection is
returned to React. If the aggregate request fails, project configuration and the
delete control remain available while only the metrics region shows an error.

Definitions:

- **Indexed files:** all current inventory records, including records marked
  missing. Missing files are also shown separately.
- **Managed assets:** active indexed files with the existing managed flag.
- **Validation severity:** open issues only, grouped by the existing
  info/warning/error values.
- **Environment key coverage:** distinct uncommented key definitions observed
  for an environment divided by all known project key definitions. Commented
  keys are absent, duplicates count once, optional/forbidden rule meaning is not
  inferred, and unreadable/parse-problem source counts are shown separately.
  Therefore 100% means key-name presence, not correct configuration.
- **Scan activity:** the eight most recent existing `scan_runs`; no new analytics
  persistence is introduced.
- **Watcher status:** shown as unavailable because the current runtime does not
  persist authoritative watcher health. The dashboard does not infer health from
  the existence of watched-location records.

Recharts receives only aggregate series. Charts disable animation, use the
existing semantic CSS tokens, have responsive containers and accessibility
layers, and include visible textual summaries. See the official
[ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/)
and [PieChart](https://recharts.github.io/en-US/api/PieChart/) references.

## Global command palette

`Ctrl+K` on Windows/Linux and `Cmd+K` on macOS opens the palette. The shortcut
was chosen because the existing shell did not register it; it is ignored while
focus is in an input, textarea, select, content-editable region, or editor-like
control. Command filtering is client-side because the list is bounded. Metadata
text creates one explicit “Search Devventory for…” command instead of loading
database results into the palette. Global commands work without a project;
project commands appear only when an active project exists. Arrow keys, Enter,
Escape, focus trapping, and focus restoration are supported.

## Project deletion added in Phase 9

Deletion is a project-feature mutation, not dashboard business logic. The user
must open the danger-zone dialog and type the exact project name. The thin Tauri
command delegates to the project service/repository, where SQLite foreign keys
cascade all project-owned metadata, including search history. Inventory watchers
are refreshed after success. The local project directory and its files are never
deleted. TanStack Query removes the deleted project/dashboard cache, invalidates
search, and the existing active-project provider selects and persists a remaining
project when available.

Tauri command boundaries return serializable typed errors according to the
[Tauri command guidance](https://v2.tauri.app/develop/calling-rust/).
