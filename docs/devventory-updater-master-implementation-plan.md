# Devventory Updater — Master Implementation Plan

**Repository:** `kuyajp123/devventory`  
**Baseline branch:** `main`  
**Plan type:** Master roadmap / architecture contract  
**Target platform for the first complete implementation:** Windows x64, NSIS installer  
**Product principle:** Devventory remains offline-first; internet access is optional and limited to update metadata/downloads.

---

## 1. Purpose of This Document

This document defines the master scope and target architecture for adding a production-grade application update experience to Devventory.

It is intentionally a roadmap rather than a detailed implementation prompt.

The work will be implemented phase-by-phase. After this master plan is accepted, a separate detailed Phase 1 implementation plan should be created before making Phase 1 code changes.

### Implementation rule

Do **not** implement all phases from this document in one pass.

For each phase:

1. Inspect the current `main` branch again before implementation.
2. Use current official Tauri v2 documentation for updater/native behavior.
3. Keep changes isolated to the phase.
4. Verify the phase acceptance criteria before continuing.
5. Do not silently expand the scope into cloud sync, accounts, telemetry, or unrelated release tooling.

---

## 2. Product Goal

Devventory should be able to determine whether a newer production version exists and clearly tell the user when an update is available.

The intended final user experience is:

```text
Installed Devventory 0.1.0
        |
        | optional HTTPS request
        v
GitHub Release metadata says 0.2.0 is latest
        |
        v
Devventory stores update state for the current session
        |
        v
Top bar shows an update indicator
        |
        v
User opens update details
        |
        +--> Later
        |
        +--> Update Now
                |
                v
        Download signed update
                |
                v
        Verify Tauri updater signature
                |
                v
        Install / relaunch
                |
                v
        Devventory 0.2.0
```

A failed update check must never block normal use of Devventory.

---

## 3. Offline-First Contract

Adding the updater does **not** convert Devventory into a cloud application.

The updater is a narrow optional network capability.

### Remains local

The following continue to operate independently of the updater:

- SQLite application data
- project registration
- project paths
- watched locations
- file inventory
- Asset Library
- Environment Tracker
- Validation Center
- Agent Usage local data
- Settings
- system tray / Quick Access behavior

### Network access added by this feature

Only updater-related traffic is in scope:

1. Fetch update metadata from the configured HTTPS release endpoint.
2. Download a release artifact when the user elects to update.
3. No project data, environment values, file inventory, SQLite content, or user workspace data is included in the update request.

### Offline behavior

If internet access is unavailable:

- Devventory still starts normally.
- Local modules remain usable.
- Automatic update checking fails silently or becomes a non-blocking updater status.
- No blocking modal should appear merely because a startup check failed.
- A manual "Check for updates" action may report that the check could not be completed.

---

## 4. Current Repository Baseline Observed on `main`

The master plan is based on inspection of the current `main` branch.

### Frontend / package baseline

Current project characteristics include:

- React + TypeScript + Vite
- Zustand available
- Tauri JavaScript API packages
- `package.json` version currently `0.1.0`
- `npm run build` performs type checking and Vite production build
- Tauri CLI exposed through the `tauri` npm script

### Tauri baseline

Current Tauri configuration includes:

- product name `Devventory`
- identifier `com.paul.devventory`
- application version sourced from `../package.json`
- Windows bundling currently targeting NSIS
- custom application icon configuration
- no updater configuration yet
- no `createUpdaterArtifacts` setting yet

### Rust/native baseline

Current Rust application already has a substantial Tauri plugin/lifecycle setup, including:

- single-instance behavior
- opener
- dialog
- notification
- autostart
- system tray
- background startup behavior
- Quick Access secondary window

The updater must integrate into this existing Tauri builder without disrupting those behaviors.

### Capability baseline

The main-window capability currently exposes core/dialog/opener/notification permissions.

Updater permissions are not yet present.

### Frontend architecture baseline

Devventory follows feature-first frontend ownership:

```text
src/features/<feature>/
```

and shell/layout concerns live under:

```text
src/app/
```

`AppLayout.tsx` owns the top application bar, including the current right-side actions. This is the intended shell integration point for the future update indicator.

Zustand already exists in the application and is appropriate for session-level updater state.

### Settings baseline

Settings currently includes:

- Notifications
- Background & Startup

There is not yet an About/Updates section.

Adding an About/Updates section is optional for the first updater release and should not block the core top-bar experience.

### CI/release baseline

The repository currently has a CI workflow that validates:

- frontend lint/typecheck/unit/e2e/build
- Rust clippy/test/check/audit
- Conventional Commit messages on pull requests

Important current-state correction:

**The current `main` branch does not yet contain a semantic-release dependency/configuration or a dedicated release workflow.**

Conventional Commit validation is already present and provides a useful foundation, but semantic-release automation itself belongs to Phase 3.

---

## 5. Target Architecture

The updater should be treated as a dedicated product/infrastructure feature rather than scattered logic inside `AppLayout`.

Recommended ownership:

```text
src/
├── app/
│   └── layouts/
│       └── AppLayout.tsx
│
└── features/
    └── app-updater/
        ├── components/
        ├── hooks/
        ├── services/
        ├── stores/
        ├── types/
        ├── tests/
        └── index.ts
```

The exact filenames should be decided in the detailed phase plans, but the ownership boundary should remain stable.

### Frontend responsibilities

The updater frontend feature should eventually own:

- typed update state
- update check orchestration
- mapping Tauri updater responses into app-friendly models
- error normalization
- top-bar indicator component
- update details modal
- download/install progress state
- manual update check behavior
- tests

### App shell responsibilities

`AppLayout` should only compose updater UI/synchronization components.

It should not contain direct updater API calls or release logic.

### Tauri/native responsibilities

Tauri configuration/native integration should own:

- updater plugin registration
- updater public key
- updater endpoint
- updater artifact generation
- updater permissions
- any process/relaunch integration required by the final installation flow

### Release infrastructure responsibilities

GitHub releases/automation should own:

- determining the released version
- building the Windows NSIS production installer
- signing updater artifacts with the Tauri private signing key
- publishing release assets
- exposing updater metadata such as `latest.json`
- release notes
- secure CI secret handling

---

## 6. Update State Model

The UI should not directly treat a Tauri updater object as global app state.

Use a serializable application-owned state model.

Conceptually the state needs to represent:

```text
idle
checking
upToDate
available
downloading
installing
error
```

Useful state fields will likely include:

- current version
- latest version
- release notes
- publication date when available
- whether an update is available
- check status
- download progress
- last non-fatal error
- whether the update modal is open

Do not persist the entire updater state to SQLite.

Update availability is transient and should generally be recalculated against the release endpoint.

---

## 7. Update Check Policy

### Automatic checks

Final target behavior:

- perform a silent check after normal application startup
- do not delay the main UI waiting for the result
- do not show an error toast for routine offline startup failures
- avoid checking separately from every Tauri window
- keep one authoritative frontend updater synchronization owner for the main application experience

Because Devventory can remain running in the system tray, a later periodic recheck may be added, but it is not required for the initial working updater.

### Manual checks

A user-initiated check should provide explicit feedback:

- update available
- already up to date
- unable to check

Manual checks should not be silent.

### Version comparison

Use Tauri's normal updater comparison behavior.

The application should not invent a custom version comparison unless a future requirement justifies it.

Rollback/downgrade support is outside the initial scope.

---

## 8. Release Endpoint Strategy

Use **GitHub Releases + Tauri static updater metadata** for the initial implementation.

Do not build a Supabase updater API or custom backend.

Target endpoint shape:

```text
GitHub Releases
└── latest release
    ├── Windows NSIS installer
    ├── updater signature
    └── latest.json
```

The installed application queries the configured HTTPS `latest.json` endpoint.

This keeps the updater infrastructure small and appropriate for the current Devventory product stage.

---

## 9. Signing Model

Tauri updater signing is mandatory for update verification.

### Public key

The updater public key:

- is safe to distribute
- is stored in Tauri updater configuration
- is compiled into the application
- verifies downloaded updater artifacts

### Private key

The private updater signing key:

- must never be committed
- must never be stored under `src/`, `src-tauri/`, `docs/`, or another repository path
- must not be copied into normal `.env` files
- should be backed up securely
- will later be stored as a GitHub Actions secret for automated releases

Recommended CI secret names:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

The password secret is only needed if the generated signing key uses one.

### Key-loss policy

Treat the updater private key as a long-lived release credential.

Losing it can break the ability of already-installed builds to trust future updater artifacts.

A backup strategy is therefore part of Phase 1 completion, not an optional later task.

### Windows code signing

Tauri updater signing and Windows Authenticode/code signing are separate concerns.

Windows code signing may be added later for publisher reputation / SmartScreen behavior, but it is **not required to prove the updater architecture works**.

Do not block the first updater implementation on purchasing a Windows code-signing certificate.

---

# 10. Phase Roadmap

The implementation is divided into three phases.

---

## PHASE 1 — Updater Detection Foundation

### Objective

Make an installed older Devventory build detect a newer Devventory release from GitHub.

### Target milestone

```text
Installed Devventory 0.1.0
        |
        v
check()
        |
        v
GitHub latest release = 0.1.1
        |
        v
Updater reports:
"0.1.1 is available"
```

No polished top-bar indicator is required yet.

### Scope

Phase 1 should establish:

- Tauri updater plugin dependency
- Tauri updater plugin initialization
- updater JavaScript bindings
- main-window updater capability/permission
- signing key pair generation
- secure private-key handling rules
- public-key configuration
- `createUpdaterArtifacts`
- GitHub `latest.json` endpoint configuration
- Windows NSIS updater artifact generation
- a manual test release
- a minimal typed frontend updater gateway
- a minimal `check()` proof
- deterministic test procedure using an older installed build
- graceful offline/error behavior

### Important architecture requirement

Do not call Tauri updater APIs directly from `AppLayout`.

The first detection call should already sit behind an updater-owned service/gateway so Phase 2 can build on it without moving infrastructure later.

### Engineering-rule alignment

The repository currently states that Devventory should remain offline-first and should not add HTTP synchronization.

The updater is not application-data synchronization.

Phase 1 should clarify the engineering documentation so that:

- project/application data HTTP synchronization remains prohibited
- the official updater's narrowly scoped release metadata/download traffic is explicitly permitted

Do not weaken the broader offline-first rule.

### Phase 1 completion gate

Phase 1 is complete only when all of the following are demonstrated:

1. An older installed Devventory build has the updater configured.
2. A newer signed test release exists on GitHub.
3. `check()` detects the newer version.
4. The same older build reports no update when the latest release is not newer.
5. The app remains fully usable without internet.
6. Invalid/unreachable updater metadata does not crash startup.
7. The updater private key is absent from Git history.
8. Generated updater artifacts/signatures are understood and documented.
9. Existing lint/typecheck/unit/e2e/Rust checks still pass.

A separate detailed Phase 1 implementation plan will define exact files, commands, tests, and release steps.

---

## PHASE 2 — Update State, Indicator, Modal, and User-Triggered Installation

### Objective

Turn the working update detection foundation into a polished Devventory desktop experience.

### User experience

When no update exists:

```text
Top bar
└── no updater indicator
```

When an update exists:

```text
Top bar
└── update indicator
    └── click
        └── update details modal
```

Suggested modal content:

- "Update available"
- current version
- latest version
- release notes / what's new
- Later
- Update Now

### Scope

Phase 2 should add:

- dedicated Zustand updater store
- startup synchronization component/hook
- top-bar update indicator
- update modal
- manual check capability
- user-triggered download
- progress reporting
- install state
- successful relaunch/update completion flow
- appropriate process plugin integration if required
- user-facing error handling
- accessibility states
- tests for state transitions and UI behavior

### Top-bar placement

The existing `AppLayout` top bar already has right-side shell controls.

The updater indicator should be composed into that action area without embedding updater business logic into the layout.

### Update behavior

Updates should not install silently without the user's action in the first release.

Preferred initial behavior:

```text
update detected
    |
    v
indicator shown
    |
    v
user opens modal
    |
    +--> Later
    |
    +--> Update Now
            |
            v
        download
            |
            v
        install
            |
            v
        relaunch
```

### Download/install progress

Use updater-provided progress events rather than fake timers.

The UI may display an indeterminate state when total content length is unknown.

### Release notes

Release notes should come from updater/release metadata.

Do not create a second persistent changelog database inside Devventory.

### Optional settings integration

A small About/Updates settings section may be introduced if useful, for example:

```text
Devventory
Version 0.2.0
[Check for Updates]
```

This is optional unless required by the detailed Phase 2 design.

The top-bar indicator remains the primary notification mechanism.

### Phase 2 completion gate

Phase 2 is complete when:

1. startup update checks are non-blocking
2. update availability reaches Zustand state
3. the top-bar indicator appears only when appropriate
4. the modal accurately shows current/latest versions
5. manual checking provides explicit feedback
6. "Later" leaves the application unchanged
7. "Update Now" downloads the authentic signed artifact
8. real progress is represented safely
9. failed download/install can be retried without corrupting app state
10. successful update installation follows the intended Windows lifecycle
11. app data remains intact across an update
12. existing system tray / Quick Access / single-instance behavior remains correct
13. automated frontend tests cover updater state/UI paths
14. standard frontend and Rust verification still passes

---

## PHASE 3 — Automated Versioning and Release Pipeline

### Objective

Remove the manual release work used during Phase 1 and automatically publish updater-compatible Devventory releases from trusted CI.

### Desired final pipeline

```text
Conventional Commits
        |
        v
merge/push to main
        |
        v
CI succeeds
        |
        v
semantic-release determines next SemVer
        |
        v
release workflow obtains version
        |
        v
production Tauri build
        |
        +--> NSIS installer
        +--> updater signature
        +--> updater metadata
        |
        v
GitHub Release
        |
        v
latest.json
        |
        v
installed Devventory detects update
```

### Existing foundation to reuse

The current repository already validates Conventional Commit messages and has separate frontend/Rust CI checks.

Phase 3 should build on that rather than replacing it with a parallel quality system.

### Semantic-release work required

Because semantic-release is not currently configured on `main`, Phase 3 must explicitly establish:

- semantic-release dependency
- release configuration
- commit analyzer
- release notes generation
- GitHub release publishing integration
- `main` as the production release branch
- safe token/permission configuration

Do not assume semantic-release is already functional merely because commitlint is present.

### Critical version-source requirement

Tauri currently obtains the application version from `package.json`.

The release pipeline must guarantee that the version embedded in the built Devventory binary/installer equals the semantic-release version.

Do not allow a pipeline that creates a Git tag such as:

```text
v0.2.0
```

while the built application still reports:

```text
0.1.0
```

The detailed Phase 3 plan must choose one authoritative version handoff strategy and test it.

The strategy may update version files in the CI workspace without necessarily committing version bumps back to `main`.

### Cargo version

`src-tauri/Cargo.toml` also currently has a package version.

The detailed Phase 3 plan should decide whether to keep it synchronized with the application release version.

Prefer consistency unless there is a deliberate reason for Rust crate metadata to remain independent.

### Release workflow requirements

The automated release path must:

- run only after required quality checks succeed
- build on a trusted branch/context
- have GitHub contents/release permissions only where required
- receive the Tauri signing private key through GitHub Actions secrets
- never print the private key to logs
- generate signed updater-compatible NSIS artifacts
- publish the correct updater metadata
- produce release notes
- make the newest stable release discoverable through the configured updater endpoint

### Release safety

A failed build must not publish a valid-looking latest release with missing or mismatched updater artifacts.

Prefer atomic/sequenced release behavior:

1. determine version
2. build
3. validate artifacts
4. publish/update release
5. expose it as latest

### Phase 3 completion gate

Phase 3 is complete when:

1. a qualifying Conventional Commit on `main` produces the expected SemVer
2. CI quality gates complete before release publication
3. the produced application reports the released version
4. signed NSIS updater artifacts are generated
5. `latest.json` points to the correct artifact and signature
6. GitHub Release assets are complete
7. an older installed Devventory detects the automated release
8. the update installs successfully
9. non-release commits produce no release when appropriate
10. signing secrets never appear in repository history or CI logs
11. failure cases do not leave a broken release marked as latest

---

# 11. Final Integration Audit

After Phase 3, perform one end-to-end audit instead of adding another feature phase.

Test the entire release chain with two real versions.

Example:

```text
Install Devventory 0.2.0
        |
        v
publish Devventory 0.2.1 through automation
        |
        v
0.2.0 detects 0.2.1
        |
        v
indicator appears
        |
        v
Update Now
        |
        v
0.2.1 starts
        |
        v
existing SQLite/projects/settings still present
```

Audit:

- cold startup
- tray/background startup
- app hidden to tray
- no internet
- slow internet
- malformed/unavailable endpoint
- update available
- no update
- download failure
- signature failure
- successful install
- relaunch
- preserved SQLite data
- preserved settings
- single-instance behavior after relaunch
- Quick Access behavior after relaunch
- production build with DevTools/context-menu production guards still behaving as intended

---

# 12. Proposed File Ownership Across the Whole Feature

This is a target map, not an instruction to create all files immediately.

```text
src/
├── app/
│   └── layouts/
│       └── AppLayout.tsx
│           # composition only
│
└── features/
    └── app-updater/
        ├── components/
        │   ├── update indicator
        │   └── update modal
        ├── hooks/
        │   └── startup/manual updater orchestration
        ├── services/
        │   └── typed Tauri updater gateway
        ├── stores/
        │   └── Zustand updater session state
        ├── types/
        ├── tests/
        └── index.ts

src-tauri/
├── capabilities/
│   └── default.json
│       # updater permission
├── src/
│   └── lib.rs
│       # plugin registration only where needed
└── tauri.conf.json
    # updater endpoint, public key, updater artifacts

.github/
└── workflows/
    ├── ci.yml
    └── release workflow (Phase 3)

release configuration
└── semantic-release config (Phase 3)
```

If the detailed phase inspection finds a more appropriate existing abstraction, reuse it rather than duplicating this structure.

---

# 13. Error-Handling Contract

Updater errors are not equivalent to core application failures.

### Silent startup check

Routine failures such as:

- no internet
- DNS failure
- GitHub unavailable
- timeout

must not prevent startup.

The updater may record a transient error state for diagnostics/manual checking.

### Manual check

User-triggered checks should surface a concise error and allow retry.

### Download/install

Once the user explicitly chooses Update Now, errors should be visible.

Examples:

- download failed
- update verification failed
- install failed

Never claim the update succeeded until the updater/install lifecycle confirms it.

### Signature verification

Do not provide a bypass UI for signature failures.

A signature failure is a hard stop for that update artifact.

---

# 14. Security Requirements

1. Never commit the updater private key.
2. Never place the updater private key in frontend code.
3. Never send the updater private key to the application at runtime.
4. Public updater key may be compiled into the app.
5. Use HTTPS production endpoints.
6. Do not enable insecure transport for the production GitHub updater.
7. Use only required Tauri capabilities.
8. Do not expose generic HTTP/network permissions merely to implement the updater when the official updater plugin is sufficient.
9. Do not treat hidden DevTools/right-click blocking as an update security boundary.
10. Do not include project information in updater URLs/headers unless a future explicitly approved requirement needs it.

---

# 15. Testing Strategy

## Unit tests

Focus on application-owned logic:

- response mapping
- state transitions
- progress calculation
- user-facing status derivation
- error normalization
- indicator visibility

Avoid trying to unit-test Tauri internals themselves.

## Component tests

Cover:

- indicator absent/present
- modal content
- Later
- Update Now state
- progress
- errors
- retry

## Integration/manual tests

Updater artifact/signature behavior requires a real packaged application and release endpoint.

At least Phase 1 and the final audit require testing an installed older NSIS build against a newer GitHub release.

## Existing regression suite

Each phase must continue to run the repository's normal verification commands, including:

- lint
- formatting check
- typecheck
- unit tests
- browser/e2e tests
- frontend build
- Rust formatting
- clippy
- Rust tests
- cargo check
- cargo audit where available

---

# 16. Non-Goals

The following are outside the initial updater implementation:

- Devventory account/login requirement
- cloud database
- Supabase update service
- custom update backend
- project/cloud sync
- telemetry requirement
- forced updates
- mandatory always-online behavior
- silent background installation without user choice
- rollback/downgrade UI
- beta/update channels
- delta/patch updates
- Microsoft Store update integration
- macOS/Linux production release pipeline
- Windows code-signing certificate purchase

These can be reconsidered later without changing the basic updater architecture.

---

# 17. Decisions Locked by This Master Plan

Unless a later requirement explicitly changes them:

1. Devventory remains offline-first.
2. GitHub Releases is the initial update distribution source.
3. Tauri v2 Updater is the update engine.
4. Tauri updater signatures are required.
5. NSIS remains the initial Windows installer/updater artifact.
6. Phase 1 proves update detection before UI work.
7. Phase 2 owns Zustand state + indicator + update modal + user-triggered installation.
8. Phase 3 owns semantic-release + GitHub Actions automation.
9. Startup checks are non-blocking.
10. Offline updater failures do not break the app.
11. Private signing keys never enter the repository.
12. The app shell only composes updater UI; updater behavior belongs to its feature boundary.
13. No custom update server is introduced for the first implementation.
14. Release automation must guarantee that the built app version matches the published SemVer.

---

# 18. Primary Documentation to Re-Verify During Implementation

Because Tauri and CI tooling can change, the detailed phase plans must re-check current official docs immediately before implementation.

Primary references:

- Tauri v2 Updater: https://v2.tauri.app/plugin/updater/
- Tauri updater JavaScript API: https://v2.tauri.app/reference/javascript/updater/
- Tauri GitHub Actions distribution: https://v2.tauri.app/distribute/pipelines/github/
- Tauri Windows code signing (future/optional): https://v2.tauri.app/distribute/sign/windows/
- semantic-release configuration: https://semantic-release.gitbook.io/semantic-release/usage/configuration
- semantic-release CI configuration: https://semantic-release.gitbook.io/semantic-release/usage/ci-configuration
- semantic-release GitHub Actions recipe: https://semantic-release.gitbook.io/semantic-release/recipes/ci-configurations/github-actions

---

# 19. Next Step

Do **not** start Phase 2 or Phase 3.

The next artifact should be:

```text
Devventory Updater — Detailed Phase 1 Implementation Plan
```

That detailed plan should re-inspect `main` and specify:

- exact dependency changes
- exact Tauri configuration changes
- exact capability changes
- exact plugin initialization location
- signing-key generation and storage procedure
- GitHub test release structure
- update gateway/file placement
- `check()` test path
- failure-handling behavior
- tests
- verification commands
- Phase 1 acceptance checklist

Only after that detailed plan is reviewed should Phase 1 implementation begin.
