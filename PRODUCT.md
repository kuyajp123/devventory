# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software developers (solo developers and engineering teams) managing local project repositories, environment variables, documentation, and asset libraries across multiple local projects.

## Product Purpose

Devventory provides an offline-first desktop environment for developers to index, organize, search, and manage project-scoped assets, files, environment variable metadata, and local configuration without uploading code or credentials to cloud services. Success means instant visibility into local project assets, zero-friction file indexing, and reliable offline operation.

## Positioning

An offline-first, local-first developer inventory tool that indexes metadata in SQLite while keeping project files in-place as the ultimate source of truth, avoiding cloud dependencies, compulsory authentication, or plaintext secret storage.

## Operating Context

- Desktop operating environment powered by Tauri v2 with a web UI (React 19, Vite, Tailwind CSS v4, HeroUI v3).
- Local developer workstation filesystem, managing local project roots and watched directories.
- Desktop window constraints: minimum window dimensions, window-level active project selection, and offline local state persistence via embedded SQLx SQLite.

## Capabilities and Constraints

### Capabilities

- Local project onboarding and active project selection.
- Project-scoped file inventory with metadata indexing (path, size, category, MIME type, modified date, tags, hash).
- Local Asset Library for importing, categorizing, and managing project assets and variants.
- Environment key name parsing and tracking (persisting key definitions and schemas only).
- A global Credential Vault for user-entered credentials, with metadata and project/environment associations in SQLite and optional values encrypted in a password-protected local Stronghold snapshot.
- Bounded file system scanning and local file watcher event reconciliation.

### Constraints

- Strictly offline-first: no external HTTP APIs, cloud synchronization, or remote database dependencies in the MVP.
- Project files remain the source of truth; indexed files store metadata only and avoid full file duplication.
- Scanned environment-file values are never persisted; Environment Tracker, search, validation, dashboards, and exports consume key metadata only.
- Optional values entered explicitly in Credential Vault are persisted only in encrypted Stronghold storage. SQLite stores an opaque secret reference, never the plaintext value.
- Credential Vault has no password recovery path. Unlock state lasts only for the current process session; manual lock or application quit clears it.
- Local filesystem paths remain device-specific and non-portable.
- File inventory scans apply exclusions before descent, skip symbolic links/junctions, and run in bounded batches.

## Brand Commitments

- Product Name: **Devventory**
- Voice: Technical, reliable, clean, developer-native, precision-focused.
- UI Foundation: Modern dark/light interface built with HeroUI v3 and Tailwind CSS v4.

## Evidence on Hand

- Implementation Spec: [Devventory_Implementation_Plan.md](file:///c:/Users/Paul/Projects/devventory/docs/Devventory_Implementation_Plan.md)
- Engineering Rules & Architecture Boundaries: [AGENTS.md](file:///c:/Users/Paul/Projects/devventory/AGENTS.md)
- Codebase Foundation: Complete Tauri v2 + React 19 codebase with embedded SQLite migrations, IPC gateways, and feature modules under `src/features/`.

## Product Principles

1. **Offline-First Authority**: Every feature, search, and workflow functions completely offline without requiring network access, user login, or remote services.
2. **In-Place Truth**: Project files remain inside original project directories; Devventory indexes non-destructive metadata and manages explicit asset imports without cloning or modifying user repositories unnecessarily.
3. **Privacy by Design**: Scanned secret values are excluded from persistence and from every derived feature. Values explicitly entrusted to Credential Vault are encrypted locally, revealed only on demand while unlocked, and never stored in SQLite.
4. **Focused Desktop Ergonomics**: High-density, fast keyboard-friendly UI tailored for developer speed, deep file scannability, and minimal cognitive load.

## Accessibility & Inclusion

- Keyboard navigation support across all core desktop flows, tables, and asset grids.
- WCAG AA contrast standards across dark and light desktop themes.
- Clear visual hierarchy with distinct focus indicators for keyboard-only interaction.
