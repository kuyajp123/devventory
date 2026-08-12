# Devventory Updater — Detailed Phase 2 Implementation Plan

**Repository:** `kuyajp123/devventory`  
**Source branch:** `main`  
**Inspected `main` HEAD when this plan was created:** `1b2413b2348853af15cfb5c0493a146e5ac25afa`  
**Current repository state at planning time:** Phase 1 updater code is not yet present on `main`  
**Phase prerequisite:** Phase 1 must be fully implemented and accepted before Phase 2 begins  
**Public updater feed:** `kuyajp123/devventory-releases`  
**Target platform:** Windows x64  
**Installer:** NSIS  
**Phase:** 2 — Update UX, State, Download, Install, and Relaunch  
**Execution model:** Coding-agent driven, with user involvement only for unavoidable secure/release authorization actions.

---

# 1. Phase 2 Goal

Phase 2 turns the Phase 1 updater foundation into a complete user-facing update experience.

The target workflow is:

```text
Devventory starts
      |
      | non-blocking check once per app session
      v
Update available?
      |
      +---- no ----> continue normally
      |
      +---- yes
              |
              v
      top-bar update indicator
              |
              | user clicks
              v
         Update modal
       current -> latest
       release notes
       Later / Update Now
              |
              | Update Now
              v
       fresh update re-check
              |
              v
       signed update download
              |
              v
       live download progress
              |
              v
          installation
              |
              v
          app relaunch
              |
              v
      new Devventory version
```

The user must always control whether an available update is installed.

There is no silent installation.

---

# 2. Phase 2 Prerequisite Gate

Do not start Phase 2 until Phase 1 proves all of the following:

```text
- Tauri updater plugin is installed.
- Tauri updater signing key exists and is backed up.
- Public key is configured.
- `createUpdaterArtifacts` is enabled.
- `devventory-releases/latest.json` is publicly accessible.
- Main window can perform `check()`.
- Updater-enabled older Devventory build detects a newer signed release.
- Offline update-check failure is non-fatal.
- No GitHub credential exists inside the installed app.
```

At Phase 2 start, the coding agent must re-inspect the actual post-Phase-1 code instead of assuming the exact file names from this document.

If Phase 1 has not been completed, stop.

Do not quietly implement Phase 1 and Phase 2 together.

---

# 3. Current Devventory UI Architecture Relevant to Phase 2

At planning time, `AppLayout.tsx` owns the top application bar and its right-side actions.

The current right side contains:

```text
Search / command palette
Context sidebar toggle
Theme toggle
```

The update indicator belongs in this same top-bar action region.

Important architecture rule:

> `AppLayout.tsx` may compose updater UI, but it must not contain Tauri updater business logic.

The current global app UI Zustand store only owns shell UI state such as:

```text
command palette
context sidebar
navigation
utility panel
```

Do **not** put updater state into:

```text
src/app/stores/app-ui.store.ts
```

Updater state belongs in its own feature store:

```text
src/features/app-updater/stores/
```

The project already has a shared modal wrapper:

```text
src/shared/ui/DevventoryDialog.tsx
```

Reuse it for the update modal unless the post-Phase-1 repository provides a more suitable shared dialog abstraction.

Do not create another global modal system.

---

# 4. Official Tauri Behavior Phase 2 Relies On

The coding agent must re-check the current official Tauri documentation immediately before implementation.

Current Tauri v2 behavior relevant to this plan:

1. `Update.downloadAndInstall()` supports progress events.
2. Progress events include:
   - `Started`
   - `Progress`
   - `Finished`
3. The updater plugin exposes separate permissions:
   - `updater:allow-check`
   - `updater:allow-download`
   - `updater:allow-install`
   - `updater:allow-download-and-install`
4. We should grant only the operations actually used.
5. The official JS example calls `relaunch()` from `@tauri-apps/plugin-process` after `downloadAndInstall()`.
6. The process plugin exposes restart/relaunch capability.
7. `process:default` grants both exit and restart; Phase 2 should prefer only the restart permission.
8. Windows updater `installMode: "passive"` is the recommended/default mode.
9. On Windows, Tauri automatically quits the application before installing an update due to installer limitations.
10. Tauri provides an optional Windows `on_before_exit` updater hook if application-specific cleanup is required.
11. Tauri's default version comparator remains:
   ```text
   update.version > currentVersion
   ```
12. `@tauri-apps/api/app` provides `getVersion()` for the installed application version.

Primary documentation:

```text
https://v2.tauri.app/plugin/updater/
https://v2.tauri.app/plugin/process/
https://v2.tauri.app/reference/javascript/updater/
https://v2.tauri.app/reference/javascript/process/
https://v2.tauri.app/reference/javascript/api/namespaceapp/
```

---

# 5. Locked Phase 2 Product Decisions

These decisions are part of Phase 2 scope:

1. Check for updates once per packaged app session.
2. Startup checking is non-blocking.
3. Startup update-check failures are silent/non-disruptive.
4. Manual update checks remain available in Settings.
5. Available updates produce a top-bar indicator.
6. Clicking the indicator opens an update modal.
7. The modal shows current version, available version, release notes, and publication date when available.
8. The user may choose:
   ```text
   Later
   Update Now
   ```
9. Choosing Later never hides the update for the remainder of the session; the top-bar indicator remains.
10. Choosing Update Now performs a fresh check before downloading.
11. The app will not silently download updates.
12. Download progress is shown.
13. Cancellation is not offered once `downloadAndInstall()` has started unless current Tauri APIs provide a safe supported cancellation mechanism.
14. After installation, Devventory relaunches using the official process plugin flow.
15. Update errors do not affect local application data.
16. No project/file/environment data is sent to GitHub.
17. The public updater feed remains:
   ```text
   https://github.com/kuyajp123/devventory-releases/releases/latest/download/latest.json
   ```
18. No skipped-version feature in Phase 2.
19. No forced-update feature in Phase 2.
20. No update channels in Phase 2.

---

# 6. Phase 2 Scope

## Included

- dedicated Zustand updater state
- installed app version loading
- non-blocking startup update check
- one startup check per app session
- manual check for updates
- top-bar update indicator
- accessible update modal
- release notes/date display
- Later behavior
- user-triggered Update Now
- fresh check before install
- stale-version/race protection
- signed update download
- download progress
- installation state
- process plugin
- app relaunch
- check/download/install/relaunch error states
- About & Updates Settings section
- permission expansion using least privilege
- unit/component/integration tests
- real packaged update test
- regression testing of tray/Quick Access/autostart/single-instance
- preservation of offline-first behavior

## Excluded

- semantic-release
- automatic GitHub release publishing
- release GitHub Actions
- automatic `latest.json` generation
- update channels
- beta/nightly channels
- forced updates
- mandatory upgrade blocking screen
- skipped-version persistence
- scheduled periodic polling
- background download without user consent
- differential/patch updates
- rollback UI
- Windows Authenticode
- macOS/Linux updater UX
- cloud backend
- Supabase
- update history database

Those are Phase 3 or future work.

---

# 7. Target Feature Structure

Phase 2 should extend the Phase 1 feature rather than creating a new updater area.

Expected structure after adaptation to actual Phase 1 files:

```text
src/features/app-updater/
├── components/
│   ├── AppUpdateIndicator.tsx
│   ├── AppUpdateModal.tsx
│   └── AppUpdaterSync.tsx
├── hooks/
│   └── useAppUpdaterActions.ts
├── services/
│   ├── app-updater.gateway.ts
│   └── app-updater.gateway.test.ts
├── stores/
│   ├── app-updater.store.ts
│   └── app-updater.store.test.ts
├── types/
│   └── app-update.types.ts
├── tests/
│   ├── AppUpdateIndicator.test.tsx
│   ├── AppUpdateModal.test.tsx
│   └── AppUpdaterSync.test.tsx
└── index.ts
```

Settings integration:

```text
src/features/settings/
└── components/pages/appropriate existing settings structure
    └── AboutUpdatesSettingsSection.tsx
```

The exact settings subfolder must follow the repository's post-Phase-1 conventions.

Do not move feature-specific updater state to shared code.

---

# 8. Phase 2 State Model

Create a dedicated, session-only Zustand store.

Recommended status union:

```ts
type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'relaunching'
  | 'error';
```

Recommended state:

```text
status
currentVersion
availableUpdate
lastCheckedAt
isModalOpen

download:
  downloadedBytes
  totalBytes
  percentage

error:
  stage
  message

startupCheckStarted
```

Recommended error stages:

```ts
type AppUpdateErrorStage =
  | 'version'
  | 'check'
  | 'download'
  | 'install'
  | 'relaunch';
```

Do not persist this store to SQLite/localStorage.

Reasons:

- update availability changes externally
- progress is ephemeral
- errors are session-specific
- the app should perform a new check in each new session

---

# 9. Store Rules and Invariants

The implementation must enforce:

```text
idle
  -> checking

checking
  -> upToDate
  -> available
  -> error

available
  -> checking        # manual refresh/fresh install verification
  -> downloading
  -> idle only when app session resets

downloading
  -> installing
  -> error

installing
  -> relaunching
  -> error

relaunching
  -> app exits/restarts
  -> error if relaunch call itself fails
```

Additional invariants:

- only one check may be active at a time
- only one installation workflow may be active at a time
- Update Now must be disabled while already busy
- manual Check for Updates must be disabled during download/install/relaunch
- closing the modal must not reset available-update metadata
- Later closes only the modal
- startup check must not reopen the modal automatically
- the top-bar indicator appears only when an update is available or actively being installed/downloaded
- a startup check error must not create a top-bar error indicator

---

# 10. Step 1 — Re-Inspect Phase 1 Before Editing

The coding agent must inspect actual:

```text
package.json
src-tauri/Cargo.toml
src-tauri/tauri.conf.json
src-tauri/src/lib.rs
src-tauri/capabilities/default.json
src-tauri/capabilities/quick-access.json
src/features/app-updater/**
src/app/layouts/AppLayout.tsx
src/app/providers/AppProviders.tsx
src/features/settings/**
src/app/router/routes.tsx
src/shared/ui/DevventoryDialog.tsx
AGENTS.md
```

Confirm:

```text
Phase 1 updater detection works.
```

If the Phase 1 gateway structure differs from this plan, reuse and extend it.

Do not replace working Phase 1 code merely to match file names written here.

---

# 11. Step 2 — Install the Tauri Process Plugin

Phase 2 needs application relaunch.

Use the official plugin setup, normally:

```powershell
npm run tauri add process
```

Audit generated changes.

Expected:

```text
@tauri-apps/plugin-process
tauri-plugin-process
Rust plugin initialization
capability changes
```

Do not accept `process:default` as the final permission if only restart is required.

Preserve all existing native lifecycle plugins.

---

# 12. Step 3 — Expand Tauri Permissions Minimally

Phase 1 should already have:

```text
updater:allow-check
```

Phase 2 should add only:

```text
updater:allow-download-and-install
process:allow-restart
```

Final intended main-window permissions:

```text
updater:allow-check
updater:allow-download-and-install
process:allow-restart
```

Do not grant:

```text
updater:default
process:default
updater:allow-download      # unnecessary if using downloadAndInstall only
updater:allow-install       # unnecessary if using downloadAndInstall only
process:allow-exit          # unnecessary
```

unless current official APIs prove they are required.

Do not add updater/process permissions to Quick Access.

---

# 13. Step 4 — Lock Windows Install Mode

Use Windows:

```json
"installMode": "passive"
```

unless Phase 1 already explicitly configured it.

This gives the normal small Windows installer progress UI and does not require a separate interactive installer flow.

Do not use:

```text
quiet
```

for Phase 2.

Do not switch to `basicUi` unless testing proves passive mode conflicts with Devventory's installer requirements.

---

# 14. Step 5 — Extend the Updater Gateway

Phase 1 likely has:

```text
checkForAppUpdate()
```

Phase 2 should extend the native gateway/service boundary to support:

```text
getCurrentAppVersion()
checkForAppUpdate()
downloadAndInstallAppUpdate(...)
relaunchApp()
```

Use:

```text
@tauri-apps/api/app
@tauri-apps/plugin-updater
@tauri-apps/plugin-process
```

only inside feature-owned service/gateway modules.

UI components must not directly import the updater/process APIs.

---

# 15. Step 6 — Current Version Loading

Use:

```text
getVersion()
```

from Tauri's app API.

Why:

If `check()` returns `null`, there is no update resource from which to derive the current version.

The About & Updates page should still show:

```text
Current version: 0.x.x
```

without requiring an available update.

Load it once per app session and store it in the updater store.

Failure to retrieve app version should not crash the app.

---

# 16. Step 7 — Fresh Re-Check Before Download

Never rely solely on the update metadata discovered during startup.

There may be a gap between:

```text
startup check
```

and:

```text
user clicks Update Now
```

During that gap the release feed could change.

On Update Now:

```text
1. perform a fresh `check()`
2. compare the newly available version with the version shown in the modal
```

Possible outcomes:

### Same version

```text
expected 0.1.2
fresh    0.1.2
```

Proceed to download/install.

### No update

```text
fresh check -> null
```

Transition to `upToDate`.

Tell the user the update is no longer available/current version is already up to date.

### Newer/different version

```text
modal showed 0.1.2
fresh check shows 0.1.3
```

Do **not** silently install a different version from the one the user approved.

Instead:

```text
- update store metadata to 0.1.3
- return to `available`
- keep/open modal
- show new release information
- require Update Now again
```

This creates explicit consent for the actual version being installed.

---

# 17. Step 8 — Native Update Resource Ownership

Do not place the raw Tauri `Update` object in Zustand.

The gateway should own the native resource.

For detection:

```text
check()
-> map metadata
-> close resource
```

For installation:

```text
fresh check()
-> validate expected version
-> downloadAndInstall()
-> release/close resource if the process remains alive
```

Use `try/finally` where appropriate.

Do not leak native updater resources across React component lifecycles.

---

# 18. Step 9 — Download Progress Model

Tauri emits progress events.

Map them into an application-owned progress model.

Recommended:

```ts
interface AppUpdateDownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percentage: number | null;
}
```

On:

```text
Started
```

set:

```text
downloadedBytes = 0
totalBytes = contentLength ?? null
percentage = totalBytes ? 0 : null
```

On:

```text
Progress
```

accumulate:

```text
downloadedBytes += chunkLength
```

If total is known:

```text
percentage =
  clamp((downloadedBytes / totalBytes) * 100, 0, 100)
```

On:

```text
Finished
```

set percentage to 100 when total is known.

If total length is unavailable, show indeterminate progress rather than fabricated percentages.

---

# 19. Step 10 — Dedicated Zustand Store

Create:

```text
src/features/app-updater/stores/app-updater.store.ts
```

Do not place async Tauri APIs directly into the store unless the repository's established feature-store convention strongly supports it.

Preferred separation:

```text
gateway
  native operations

useAppUpdaterActions
  async workflow / orchestration

Zustand store
  state + synchronous transitions

components
  rendering / user events
```

This keeps the store easy to unit test and prevents native dependencies from becoming global state infrastructure.

---

# 20. Step 11 — `useAppUpdaterActions`

Create a feature hook/controller responsible for:

```text
loadCurrentVersion()
checkForUpdates(source)
openUpdateModal()
closeUpdateModal()
installAvailableUpdate()
```

Possible check sources:

```ts
type UpdateCheckSource = 'startup' | 'manual' | 'preInstall';
```

The source controls UX behavior:

### startup

- no success toast
- no offline/error toast
- no modal auto-open
- update indicator appears when available

### manual

- visible checking state
- show "You're up to date" when no update
- show an error/toast when check fails
- open update modal automatically when update is found

### preInstall

- no generic toast
- handles stale-version/no-update race explicitly

---

# 21. Step 12 — Startup Update Sync

Create:

```text
AppUpdaterSync.tsx
```

Responsibilities:

1. run after React app has mounted
2. load installed app version
3. perform one non-blocking startup update check
4. never block rendering
5. never open a modal automatically
6. never show an offline error toast
7. guard against duplicate checks

Recommended composition:

```text
AppProviders
  |
  +-- AppUpdaterSync
```

This is a global lifecycle feature and is not project-scoped.

It should not depend on an active project.

Do not run the production updater startup check in an ordinary browser-only Vite environment.

The implementation should distinguish the packaged Tauri environment appropriately and remain testable.

---

# 22. Step 13 — One Check Per Session

Use a session guard:

```text
startupCheckStarted
```

or an equivalent module/store invariant.

Do not persist this flag across application restarts.

A new application process should be allowed to check again.

Manual checks remain available even after the startup check.

Do not add periodic polling in Phase 2.

---

# 23. Step 14 — Top-Bar Update Indicator

Create:

```text
AppUpdateIndicator.tsx
```

Compose it inside the top application bar's existing right-side action area.

Recommended placement:

```text
Search
Update indicator (when available)
Context sidebar
Theme
```

Do not insert updater logic directly into `AppLayout`.

`AppLayout` should only render:

```tsx
<AppUpdateIndicator />
<AppUpdateModal />
```

or equivalent feature exports.

### Indicator states

#### No available update

Render nothing.

#### Update available

Show a compact button/icon with accessible label such as:

```text
Update available: Devventory 0.1.2
```

Optional visible text on wider layouts:

```text
Update 0.1.2
```

#### Downloading

The same indicator may show a small progress state.

Do not allow it to start a second update operation.

#### Installing/relaunching

Show busy state if the app remains visible.

---

# 24. Step 15 — Update Modal

Create:

```text
AppUpdateModal.tsx
```

Reuse:

```text
DevventoryDialog
```

unless repository conventions changed.

Recommended available-state content:

```text
Devventory update available

Current version
0.1.1

New version
0.1.2

Published
Aug xx, 2026

What's new
<release notes>

[Later] [Update Now]
```

### Release notes safety

Treat release metadata as external text.

Do not inject raw HTML.

Prefer:

```text
plain text
preserved line breaks
safe text rendering
```

A Markdown renderer should not be added solely for Phase 2 unless the repository already has a safe one.

---

# 25. Step 16 — Later Behavior

When the user selects:

```text
Later
```

only:

```text
isModalOpen = false
```

The available update remains in the store.

The top-bar indicator remains visible.

Do not create:

```text
skip version
ignore forever
remind tomorrow
```

in Phase 2.

---

# 26. Step 17 — Update Now Behavior

When the user chooses Update Now:

```text
1. disable duplicate update actions
2. perform fresh check
3. verify expected version
4. begin downloadAndInstall
5. show progress
6. transition to installing
7. relaunch app
```

Before starting, the modal should tell the user that Devventory will restart.

Recommended copy intent:

```text
Save any unfinished edits. Devventory will restart to finish the update.
```

Do not claim all temporary form input is automatically preserved unless Devventory actually guarantees that.

---

# 27. Step 18 — Modal Behavior While Busy

During:

```text
downloading
installing
relaunching
```

do not offer a fake Cancel button.

If the selected Tauri API does not provide a reliable cancellation mechanism, cancellation must not be implied.

Recommended behavior:

```text
downloading:
  modal remains visible
  close/dismiss ignored or disabled
  show progress

installing:
  modal remains locked
  show "Installing update…"

relaunching:
  modal remains locked
  show "Restarting Devventory…"
```

If the current shared dialog cannot disable dismissal, handle `onOpenChange(false)` by ignoring it while the updater is busy.

Do not modify the shared dialog globally unless a reusable `isDismissable` capability is genuinely needed by other features.

---

# 28. Step 19 — Process Relaunch

Install and use:

```text
@tauri-apps/plugin-process
```

After successful `downloadAndInstall()`:

```text
status = relaunching
await relaunch()
```

Use only:

```text
process:allow-restart
```

unless current plugin requirements prove otherwise.

If relaunch fails while the application is still running:

```text
status = error
error.stage = relaunch
```

Tell the user the update was installed but Devventory could not restart automatically, if that is what the actual runtime outcome indicates.

Do not fabricate installation success if `downloadAndInstall()` itself failed.

---

# 29. Step 20 — Windows Exit / Tray Interaction Audit

Tauri documents that Windows update installation automatically quits the app before installer execution.

Devventory has custom:

```text
close-to-tray
system tray
Quick Access
background runtimes
```

The coding agent must verify that updater-driven exit is not intercepted by normal close-to-tray behavior.

Do not add `on_before_exit` just because it exists.

Add it only if inspection/testing shows Devventory needs explicit cleanup before updater shutdown.

If an `on_before_exit` hook is added:

- it must be fast
- it must not make network requests
- it must not block update installation
- it must not duplicate normal shutdown behavior unnecessarily

---

# 30. Step 21 — About & Updates Settings Section

Add:

```text
Settings
└── About & Updates
```

Recommended route:

```text
/settings/about-updates
```

This gives users a manual update-check entry point even when no update indicator is visible.

Recommended content:

```text
About & Updates

Devventory
Version 0.1.1

Updates
Devventory can connect to GitHub to check for signed application updates.
Your projects and local Devventory data are not uploaded as part of this check.

[Check for Updates]
```

State-dependent feedback:

```text
checking:
  Checking for updates…

upToDate:
  You're up to date.

available:
  Version 0.1.2 is available.
  [View Update]

error:
  Unable to check for updates.
  [Try Again]
```

Do not create a separate updater settings database.

---

# 31. Step 22 — Settings Routing

Update the existing settings navigation and routes.

At planning time Settings contains:

```text
Notifications
Background & Startup
```

Add:

```text
About & Updates
```

The default Settings redirect may remain:

```text
/settings -> /settings/notifications
```

unless product design decides otherwise.

Do not make updater settings project-scoped.

---

# 32. Step 23 — Error UX

Normalize user-facing errors.

Recommended categories:

```text
Unable to check for updates.
Unable to download the update.
Unable to install the update.
The update was installed, but Devventory could not restart automatically.
```

Avoid exposing:

```text
raw filesystem paths
private key paths
tokens
stack traces
raw internal Tauri errors
```

Detailed errors may go to development logs/tracing if the repository already supports safe logging.

Never log the signing private key/password.

---

# 33. Step 24 — Startup Error Policy

Startup checks are opportunistic.

If the machine is offline:

```text
Devventory opens normally.
```

Do not:

```text
show blocking modal
show scary toast
retry continuously
disable local modules
mark the entire app unhealthy
```

The Settings About & Updates section may show that the last check failed during the current session.

A user-triggered manual check may show an explicit failure message.

---

# 34. Step 25 — Manual Check Policy

The user can manually check regardless of whether the startup check succeeded.

Manual check flow:

```text
Check for Updates
      |
      v
checking
      |
      +-- no update --> upToDate
      |
      +-- update --> available + open modal
      |
      +-- error --> error + visible feedback
```

Do not create a new check if one is already running.

---

# 35. Step 26 — Concurrency Protection

Prevent:

```text
double-click Update Now
two simultaneous check() calls
two downloadAndInstall() calls
manual check while installation is running
startup check racing manual check
```

Use store/orchestrator guards rather than UI button disabling alone.

UI disabling is secondary defense.

The workflow must remain safe even if actions are triggered programmatically twice.

---

# 36. Step 27 — Tests for the Updater Store

Permanent unit tests should verify:

```text
idle -> checking
checking -> available
checking -> upToDate
checking -> error
available -> downloading
downloading progress accumulation
downloading -> installing
installing -> relaunching
busy operations block duplicate execution
Later closes modal without clearing update
new check clears stale error/progress
```

Do not make tests depend on network/GitHub.

---

# 37. Step 28 — Gateway Tests

Extend Phase 1 gateway tests.

Required cases:

1. `getCurrentAppVersion()` maps Tauri `getVersion()`.
2. fresh check returns no update.
3. fresh check returns expected update.
4. version changed between modal and install.
5. `downloadAndInstall()` receives progress callback.
6. Started maps total size.
7. Progress accumulates chunk bytes.
8. Finished marks completion.
9. download failure is surfaced.
10. install failure is surfaced.
11. native updater resource is released when possible.
12. `relaunch()` is called only after successful install flow.
13. relaunch failure is distinguishable.

Mock Tauri packages.

---

# 38. Step 29 — Component Tests

## Indicator

Verify:

```text
idle -> hidden
upToDate -> hidden
error from startup -> hidden
available -> visible
click -> opens modal
downloading -> busy/progress indication
```

## Modal

Verify:

```text
versions rendered
release notes rendered safely
date rendered when available
Later closes only modal
Update Now triggers action
Update Now disabled while busy
busy modal cannot be accidentally dismissed
download percentage displayed when known
indeterminate state when total unknown
error + retry state
```

## Settings

Verify:

```text
current version shown
manual check button
checking disabled state
up-to-date state
available state
error/retry state
```

---

# 39. Step 30 — Accessibility

Top-bar indicator:

- real button
- meaningful accessible label
- keyboard reachable
- visible focus state
- icon not the only accessible meaning

Modal:

- focus trapped by existing dialog
- appropriate title/description
- Later and Update Now reachable by keyboard
- busy actions disabled
- progress exposes accessible value
- indeterminate progress is announced correctly
- error messages are readable by assistive technology

Do not use color alone to indicate progress/error/update availability.

---

# 40. Step 31 — Real Packaged Phase 2 Test

Do not consider Phase 2 complete from mocks alone.

Preferred real test progression after the Phase 1 `v0.1.1` test:

```text
Build a Phase-2-enabled Devventory 0.1.1 locally.
Install it as the baseline.

Build and sign Devventory 0.1.2.
Publish v0.1.2 to devventory-releases.
```

It is okay that the Phase-1 public `v0.1.1` asset did not contain Phase 2 code.

The local baseline just needs to actually report:

```text
0.1.1
```

Then test:

```text
0.1.1 startup
   -> indicator sees 0.1.2
   -> open modal
   -> Update Now
   -> progress
   -> install
   -> restart
   -> Devventory reports 0.1.2
```

Do not overwrite the previously published `v0.1.1` test release merely to inject Phase 2 code.

---

# 41. Step 32 — Post-Relaunch Validation

After the update completes and Devventory restarts, verify:

```text
installed version = expected new version
```

Also verify:

- SQLite database still exists
- projects still exist
- file inventory metadata still exists
- environment configuration still exists
- Agent Usage data still exists
- app settings remain
- tray launches
- Quick Access launches
- single-instance behavior works
- autostart preferences were not reset

The updater must replace application binaries, not application data.

---

# 42. Step 33 — Offline Regression Test

Run the Phase-2-enabled app with no internet.

Expected:

```text
App starts
Dashboard works
Projects work
File Inventory works
Environment Tracker works
Agent Usage works
Settings works
Tray works
Quick Access works
```

Startup updater check failure must be invisible/non-blocking.

About & Updates may report manual-check failure when the user requests it.

---

# 43. Step 34 — Release Feed Race Test

Test:

```text
modal initially shows 0.1.2
```

then simulate:

```text
feed changes to 0.1.3 before Update Now
```

Expected:

```text
fresh check discovers 0.1.3
download does NOT begin
modal updates to 0.1.3
user must confirm Update Now again
```

This is an important consent/safety acceptance case.

---

# 44. Step 35 — Install Failure Test

Where feasible, simulate or mock:

```text
downloadAndInstall rejection
```

Expected:

```text
status = error
app remains running when runtime allows
user sees actionable retry/close behavior
no fake "installed" message
```

Do not call relaunch after failed installation.

---

# 45. Step 36 — Relaunch Failure Test

Mock/process-test:

```text
downloadAndInstall succeeds
relaunch rejects
```

Expected:

```text
error stage = relaunch
```

Provide clear user guidance based on actual state.

The UI should not claim that download failed if the problem was only relaunch.

---

# 46. Step 37 — Update Modal Release Notes

Use the `notes`/`body` from updater metadata.

Do not add a database table for release notes.

Do not fetch GitHub release notes through a separate API.

The updater metadata is the source of truth for this UI.

This keeps the update flow independent of GitHub authentication/API rate-limit complexity.

---

# 47. Step 38 — No Persistent "Last Checked" Requirement

`lastCheckedAt` may exist in the session store and be displayed during the current session.

Do not persist it to SQLite in Phase 2.

No history table is needed.

A new process performs a new startup check.

---

# 48. Step 39 — Development Environment Behavior

Do not let browser-only Vite/Playwright environments accidentally call native updater APIs.

The feature should be structured so:

```text
native gateway can be mocked
startup sync can be disabled outside packaged Tauri runtime
components can be tested with Zustand state
```

Do not hardcode production behavior into test environments.

For real updater acceptance, use packaged Tauri builds.

---

# 49. Step 40 — Logging

Safe logs may include:

```text
update check started
update available version
download started
download progress
install started
relaunch requested
sanitized error category
```

Never log:

```text
private updater key
signing password
GitHub release token
secret environment variables
project .env values
```

Release URLs are public and may be logged if useful.

---

# 50. Step 41 — Expected Permanent File Changes

After adapting to Phase 1's real structure:

```text
package.json
package-lock.json

src-tauri/
├── Cargo.toml
├── Cargo.lock
├── src/lib.rs
├── capabilities/default.json
└── tauri.conf.json

src/
├── app/
│   ├── layouts/AppLayout.tsx
│   ├── providers/AppProviders.tsx
│   └── router/routes.tsx
│
├── features/
│   ├── app-updater/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   ├── tests/
│   │   └── index.ts
│   │
│   └── settings/
│       └── About & Updates integration
│
└── shared/ui/DevventoryDialog.tsx
    # reuse; modify only if truly necessary
```

No SQLite migration.

No new backend service.

No GitHub workflow changes in Phase 2.

---

# 51. Step 42 — Required Quality Commands

Frontend:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

Rust:

```powershell
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo check
cargo audit
```

Production:

```powershell
npm run tauri build
```

Run signing/build commands with the Phase 1 signing credential safely loaded in the current environment.

Do not put signing secrets into committed files.

---

# 52. Phase 2 Security Checklist

Before completion:

- [ ] updater private key remains outside repository
- [ ] signing password not committed
- [ ] release token not embedded
- [ ] update feed is public HTTPS
- [ ] only signed updater artifacts accepted
- [ ] main has only required updater permissions
- [ ] process permission is restart only
- [ ] Quick Access has no updater/process permission
- [ ] raw update resource not stored in Zustand
- [ ] release notes rendered as safe text
- [ ] no generic HTTP permission added
- [ ] no source/project data sent during update check
- [ ] stale release version is re-confirmed before download
- [ ] duplicate install operations blocked
- [ ] no automatic installation

---

# 53. Phase 2 Acceptance Checklist

## Phase 1 dependency

- [ ] Phase 1 fully accepted
- [ ] signing key backed up
- [ ] public feed operational
- [ ] real detection already proven

## State

- [ ] dedicated feature Zustand store
- [ ] no updater data in app-ui store
- [ ] session-only state
- [ ] explicit status state machine
- [ ] progress state
- [ ] typed error stage
- [ ] concurrency guards

## Startup check

- [ ] runs once per packaged app session
- [ ] non-blocking
- [ ] independent of project selection
- [ ] no automatic modal
- [ ] startup errors silent
- [ ] no periodic polling

## Indicator

- [ ] hidden when no update
- [ ] visible when update available
- [ ] opens modal
- [ ] accessible
- [ ] shows busy state during update workflow

## Modal

- [ ] current version
- [ ] new version
- [ ] notes
- [ ] publication date when present
- [ ] Later
- [ ] Update Now
- [ ] progress
- [ ] error/retry state
- [ ] cannot be accidentally dismissed during non-cancellable install workflow

## Manual update check

- [ ] About & Updates settings section
- [ ] current version shown
- [ ] Check for Updates button
- [ ] up-to-date feedback
- [ ] available feedback
- [ ] manual error feedback

## Install

- [ ] fresh check before download
- [ ] different newly available version requires new confirmation
- [ ] signed download via Tauri updater
- [ ] progress event mapping
- [ ] no concurrent installation
- [ ] passive NSIS install
- [ ] relaunch after successful install
- [ ] relaunch error handled

## Permissions

- [ ] `updater:allow-check`
- [ ] `updater:allow-download-and-install`
- [ ] `process:allow-restart`
- [ ] no unnecessary updater permissions
- [ ] no process exit permission
- [ ] Quick Access unchanged

## Real test

- [ ] Phase-2-enabled baseline installed
- [ ] newer signed release published
- [ ] startup indicator detects release
- [ ] modal opens
- [ ] Update Now downloads
- [ ] progress shown
- [ ] update installs
- [ ] app restarts
- [ ] new version confirmed

## Regression

- [ ] SQLite data preserved
- [ ] projects preserved
- [ ] environments preserved
- [ ] Agent Usage preserved
- [ ] settings preserved
- [ ] tray works
- [ ] Quick Access works
- [ ] autostart works
- [ ] single-instance works
- [ ] close-to-tray remains normal outside updater shutdown
- [ ] app remains usable offline

## Quality

- [ ] lint passes
- [ ] formatting passes
- [ ] typecheck passes
- [ ] unit tests pass
- [ ] e2e passes
- [ ] frontend build passes
- [ ] Rust fmt passes
- [ ] clippy passes
- [ ] Rust tests pass
- [ ] cargo check passes
- [ ] cargo audit passes
- [ ] signed Tauri build passes

---

# 54. Required Coding-Agent Completion Report

When Phase 2 finishes, report:

```text
1. Starting commit / Phase 1 baseline
2. Working branch
3. Final working-tree status
4. Process plugin versions added
5. Final Tauri updater/process permissions
6. Final Windows install mode
7. Updater store status model
8. Startup check behavior
9. Manual check behavior
10. Indicator behavior
11. Modal behavior
12. Progress behavior
13. Fresh-check/stale-version behavior
14. Actual baseline version used for real test
15. Actual newer release version used
16. Update download result
17. Installation result
18. Relaunch result
19. Post-relaunch installed version
20. Local-data preservation result
21. Tray/Quick Access/autostart/single-instance regression results
22. Offline test result
23. Frontend quality command results
24. Rust quality command results
25. Secret/permission security audit result
26. Any deviations from this plan and why
27. Confirmation no Phase 3 release automation was implemented
28. Confirmation nothing was committed/pushed/released unless explicitly authorized
```

Never include:

```text
private signing key
signing password
GitHub release token
```

---

# 55. Handoff to Phase 3

Phase 2 should leave Devventory with a fully functional updater experience while releases are still prepared/published manually.

Phase 3 will automate:

```text
Conventional Commit history
        |
        v
semantic-release determines next SemVer
        |
        v
GitHub Actions quality gates
        |
        v
signed Tauri NSIS build
        |
        v
GitHub Release
        |
        v
latest.json
        |
        v
Phase 2 clients automatically discover it
```

Phase 3 must not redesign the Phase 2 user experience.

It should only automate the release-production side.

---

# 56. Stop Condition

Do not begin Phase 3 until a real packaged Phase-2-enabled Devventory build can complete this sequence:

```text
startup
  -> detect newer signed update
  -> display top-bar indicator
  -> open update modal
  -> user chooses Update Now
  -> re-check exact version
  -> download with progress
  -> install
  -> restart
  -> new version confirmed
  -> local data and desktop lifecycle behavior preserved
```

That is the completion definition for Phase 2.
