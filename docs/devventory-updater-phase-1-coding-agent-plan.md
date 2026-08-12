# Devventory Updater — Revised Detailed Phase 1 Implementation Plan

**Repository:** `kuyajp123/devventory`  
**Source branch:** `main`  
**Inspected `main` HEAD:** `1b2413b2348853af15cfb5c0493a146e5ac25afa`  
**Current app version:** `0.1.0`  
**Source repository:** Private  
**Public updater-feed repository:** `kuyajp123/devventory-releases`  
**Target:** Windows x64 / NSIS  
**Execution model:** Coding-agent driven. The user only performs unavoidable secure/account actions.

---

## 1. Purpose of This Revision

This plan replaces the earlier Phase 1 document.

The important change is responsibility ownership:

> The coding agent must perform the local development, updater setup, key-generation command, configuration, builds, test artifacts, and verification.

Do not ask the user to manually:
- install packages
- edit source/config files
- run build/test commands
- generate `latest.json`
- configure Tauri capabilities
- wire the updater plugin
- create frontend updater code

The user should only be involved where account ownership or secure credential entry/storage genuinely requires it.

The user has already reported completing the release-token setup related to `devventory-releases`. Do not ask them to recreate it during Phase 1.

---

## 2. Verified Current State

At the time this plan was regenerated:

```text
kuyajp123/devventory
├── visibility: private
├── branch: main
├── HEAD: 1b2413b2348853af15cfb5c0493a146e5ac25afa
├── app version: 0.1.0
├── Tauri version source: ../package.json
├── Windows bundle: nsis
└── updater plugin: not installed yet
```

The public update-feed repository exists:

```text
kuyajp123/devventory-releases
visibility: public
```

Keep the current NSIS bundle target.

---

## 3. Phase 1 Goal

Phase 1 succeeds when:

```text
Updater-enabled Devventory 0.1.0
        |
        | Tauri check()
        v
https://github.com/kuyajp123/devventory-releases/releases/latest/download/latest.json
        |
        | version = 0.1.1
        v
Tauri validates updater metadata
        |
        v
Devventory reports update 0.1.1 available
```

Phase 1 is **detection only**.

Do not implement the final update indicator, update modal, download/install flow, progress UI, or automated release pipeline.

---

## 4. Locked Release Architecture

Keep source private:

```text
PRIVATE
kuyajp123/devventory
```

Keep the updater feed public:

```text
PUBLIC
kuyajp123/devventory-releases
```

The installed app should use this stable endpoint:

```text
https://github.com/kuyajp123/devventory-releases/releases/latest/download/latest.json
```

This feed should remain stable even if `devventory` becomes public later.

Future Phase 3 release automation may decide where binaries are published, but existing installed clients must continue to find metadata through `devventory-releases`.

---

## 5. Responsibility Split

### Coding agent owns

The coding agent must:
- update from latest `main`
- create/use the implementation branch
- inspect current Tauri/updater state
- verify Tauri CLI version
- install the updater plugin
- edit npm/Cargo dependencies
- initialize the Tauri updater plugin
- configure the main-window capability
- run the signing-key generation command outside the repo
- configure the public key
- enable updater artifacts
- configure the update endpoint
- create `src/features/app-updater/`
- create typed update models/gateway
- create unit tests
- create a temporary verification harness
- build signed `0.1.0`
- build signed test `0.1.1`
- create `latest.json`
- inspect the actual installer and `.sig` filenames
- verify update/no-update/offline behavior
- remove temporary test UI
- run all repository checks
- perform secret-leak review
- provide a completion report

### User owns only unavoidable secure/account actions

The user may be asked to:
1. enter a signing-key password directly into a secure terminal prompt, if required
2. securely back up the private key and password
3. approve or perform a GitHub release upload only if the coding environment cannot use an authenticated GitHub session safely
4. approve any GitHub authorization prompt that cannot be completed by the coding agent

The coding agent must prepare everything before asking for a user checkpoint.

---

## 6. Release Token Status

The user reports that release-token setup for `devventory-releases` has been handled.

Phase 1 must **not** put a GitHub token into the installed application.

Never place the release token in:

```text
src/
src-tauri/
tauri.conf.json
package.json
.env
SQLite
latest.json
```

The updater feed and installer must be publicly readable.

For Phase 3, the cross-repository credential will need to be available to the workflow that runs from the private source repository. That is not a Phase 1 blocker.

---

## 7. Official Tauri Requirements

Before implementation, the coding agent must re-check current official Tauri v2 Updater documentation.

Current requirements to preserve:
- use `tauri-plugin-updater`
- use `@tauri-apps/plugin-updater`
- updater signatures are mandatory
- public key is safe to compile into `tauri.conf.json`
- private key remains secret
- `createUpdaterArtifacts: true` creates updater artifacts/signatures
- Windows NSIS installer is reused as the updater bundle
- static JSON is supported for GitHub Releases
- production endpoint must be HTTPS
- static JSON uses `windows-x86_64` for Windows x64
- `signature` is the **content** of the `.sig` file
- frontend updater commands require Tauri capabilities
- Phase 1 grants only `updater:allow-check`
- Tauri's normal version comparison remains unchanged

Primary docs:

```text
https://v2.tauri.app/plugin/updater/
https://v2.tauri.app/reference/javascript/updater/
```

---

## 8. Phase 1 Non-Goals

Do not implement:
- update indicator/badge
- update modal
- Zustand updater store
- polished startup updater UX
- periodic polling
- download/install
- progress UI
- relaunch
- semantic-release
- automated release workflow
- Supabase/custom update backend
- forced updates
- update channels
- downgrade support
- Windows Authenticode
- macOS/Linux releases

---

## 9. Step 1 — Start From Latest `main`

The coding agent must:

1. fetch/pull latest `main`
2. confirm clean working tree
3. inspect existing updater-related files
4. create/use an isolated branch

Recommended:

```text
feature/app-updater-phase-1
```

Record:

```text
git rev-parse HEAD
git status
node --version
npm --version
npm run tauri -- --version
rustc --version
cargo --version
```

Do not implement from an outdated worktree.

---

## 10. Step 2 — Verify Tauri CLI

The coding agent runs:

```powershell
npm run tauri -- --version
```

Check current official Tauri guidance for signer/key-generation compatibility.

If the installed CLI is in a known unsafe/problematic range, update it safely before generating the permanent key.

The user should not be asked to inspect/update the CLI manually.

---

## 11. Step 3 — Install Tauri Updater

Run from project root:

```powershell
npm run tauri add updater
```

Audit all generated changes.

Expected files may include:

```text
package.json
package-lock.json
src-tauri/Cargo.toml
src-tauri/Cargo.lock
src-tauri/src/lib.rs
src-tauri/capabilities/*
```

Rules:
- preserve existing Tauri plugins
- preserve tray/Quick Access
- preserve autostart/single-instance behavior
- avoid duplicate updater registration
- reject unrelated generated/refactor noise
- enforce Phase 1 least privilege

---

## 12. Step 4 — Initialize Updater in Existing Tauri Lifecycle

Integrate updater exactly once without restructuring existing lifecycle code.

Conceptually:

```text
Tauri Builder
├── single instance
├── opener
├── dialog
├── notification
├── autostart
├── updater
├── window lifecycle
├── setup
├── tray / Quick Access
└── invoke handlers
```

Phase 1 rules:
- no blocking updater request inside startup
- no updater `unwrap()` on network paths
- no download/install
- no second background updater owner
- Quick Access does not check independently

---

## 13. Step 5 — Least-Privilege Capability

Grant only:

```text
updater:allow-check
```

to the main window.

Do not use:

```text
updater:default
```

because it includes download/install permissions.

Do not add updater permission to Quick Access.

Target:

```text
main:
  check ✅
  download ❌
  install ❌

quick access:
  check ❌
  download ❌
  install ❌
```

---

## 14. Step 6 — Generate Permanent Signing Key

This is a coding-agent task.

The coding agent runs the signer command but stores the key outside the repository.

Recommended path:

```text
$HOME\.tauri\devventory-updater.key
```

Command pattern:

```powershell
npm run tauri signer generate -- -w "$HOME\.tauri\devventory-updater.key"
```

### Secure password behavior

If an interactive password prompt appears:
- the coding agent pauses at the prompt
- the user may type the password directly into the terminal
- never ask the user to paste it into chat
- never echo/log it

After generation:

```text
private key -> secret, outside repo
public key  -> safe to put in tauri.conf.json
```

---

## 15. Step 7 — Signing-Key Backup Checkpoint

After generation, the coding agent should ask only:

```text
The updater signing key was generated at <path>.
Please back up the private key and its password securely.
Do not paste them into chat.
Tell me when the backup is complete.
```

Do not ask the user to edit code.

Do not publish an updater-enabled release before the user confirms a backup exists.

---

## 16. Step 8 — Git Leak Protection

Inspect `.gitignore`.

Add a narrowly scoped protection rule if useful.

Then verify the private key is not tracked/staged/history-visible.

At minimum inspect:

```text
git status
git status --ignored
git diff --cached
```

If private key material reaches Git history before distribution, rotate the key before shipping.

---

## 17. Step 9 — Configure `tauri.conf.json`

Preserve existing product/window/bundle settings.

Add:

```json
"createUpdaterArtifacts": true
```

under `bundle`.

Add updater config:

```text
plugins.updater.pubkey
plugins.updater.endpoints
```

Endpoint:

```text
https://github.com/kuyajp123/devventory-releases/releases/latest/download/latest.json
```

Requirements:
- use public key **content**, not file path
- HTTPS only
- keep NSIS target
- do not enable insecure transport
- no install-mode customization needed in Phase 1

---

## 18. Step 10 — Create Frontend Feature Boundary

Create:

```text
src/features/app-updater/
```

Recommended Phase 1 structure:

```text
app-updater/
├── services/
│   ├── app-updater.gateway.ts
│   └── app-updater.gateway.test.ts
├── types/
│   └── app-update.types.ts
└── index.ts
```

No components, route, or store yet.

Do not call Tauri updater directly inside `AppLayout`.

---

## 19. Step 11 — Serializable Update Model

Create an app-owned type conceptually like:

```text
AvailableAppUpdate
├── currentVersion
├── version
├── body?
└── date?
```

Requirements:
- serializable
- no native resource ID
- UI neutral
- safe for Phase 2 Zustand use

---

## 20. Step 12 — Typed Updater Gateway

Implement conceptually:

```text
checkForAppUpdate()
    |
    v
Tauri check()
    |
    ├── null
    |    -> return null
    |
    └── Update resource
         -> copy metadata
         -> close resource
         -> return AvailableAppUpdate
```

Keep the Tauri import inside the feature gateway.

Do not use Axios/raw fetch for the updater.

Error semantics:

```text
null  = successful check, no newer update
error = could not determine status
```

Because Phase 1 only uses metadata, close the native `Update` resource after mapping it.

---

## 21. Step 13 — Unit Tests

Mock `@tauri-apps/plugin-updater`.

Required cases:
- update available (`0.1.0 -> 0.1.1`)
- no update (`check() -> null`)
- check/network failure stays distinguishable from null
- returned app model contains no native resource
- native update resource is closed

Do not hit GitHub from unit tests.

---

## 22. Step 14 — Temporary Verification Harness

Create temporary code to prove the packaged app can execute the real gateway.

Acceptable temporary output:
- toast
- simple temporary status
- temporary verification component

Requirements:
- calls real updater gateway
- shows current/latest versions
- works in packaged Phase 1 baseline
- no DevTools dependency
- no download/install permissions
- removed before Phase 1 finalization

Do not implement the final update UI early.

---

## 23. Step 15 — Build Updater-Enabled `0.1.0`

A pre-updater `0.1.0` cannot detect future updates.

The coding agent must build a **new updater-enabled `0.1.0` baseline**.

Configure the current shell with:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

Do not store those in a committed `.env`.

Run:

```powershell
npm run tauri build
```

Verify actual output in:

```text
src-tauri/target/release/bundle/nsis/
```

Expected shape:

```text
<actual installer>.exe
<actual installer>.exe.sig
```

Install this updater-enabled `0.1.0` for the detection test.

---

## 24. Step 16 — Build Test Update `0.1.1`

Temporarily build:

```text
0.1.1
```

using the same signing key.

Because Tauri reads `package.json`, the binary itself must truly report `0.1.1`.

Do not fake the version only in the filename/tag.

Build and verify:

```text
0.1.1 NSIS installer
0.1.1 .sig
```

Phase 3 will formalize version automation.

---

## 25. Step 17 — Generate `latest.json`

The coding agent creates this using actual output values.

Concept:

```json
{
  "version": "0.1.1",
  "notes": "Devventory updater Phase 1 detection test.",
  "pub_date": "<RFC3339>",
  "platforms": {
    "windows-x86_64": {
      "signature": "<FULL CONTENT OF .sig>",
      "url": "https://github.com/kuyajp123/devventory-releases/releases/download/v0.1.1/<ACTUAL_INSTALLER_FILENAME>"
    }
  }
}
```

Rules:
- valid SemVer
- target `windows-x86_64`
- signature is `.sig` content, not `.sig` URL
- installer URL is public
- no incomplete other-platform entries
- validate JSON before publication

---

## 26. Step 18 — Publish Manual Test Release

Preferred behavior:

1. Coding agent checks for an authenticated GitHub CLI/session.
2. If safely authenticated and authorized, it can publish the prepared release.
3. Otherwise it prepares every file and exact release field, then asks the user for the one GitHub UI publish action.

Release target:

```text
kuyajp123/devventory-releases
tag: v0.1.1
```

Assets:

```text
actual NSIS installer
actual `.sig`
latest.json
```

Never upload private signing material.

---

## 27. Step 19 — Verify Anonymous Access

The coding agent verifies that these work without credentials:

```text
https://github.com/kuyajp123/devventory-releases/releases/latest/download/latest.json
```

and the installer asset URL.

If anonymous access fails:

```text
STOP
```

Never solve it by embedding a GitHub token inside Devventory.

---

## 28. Step 20 — Real Detection Test

Run installed updater-enabled:

```text
Devventory 0.1.0
```

Expected:

```text
latest.json = 0.1.1
0.1.1 > 0.1.0
gateway returns AvailableAppUpdate
```

Verify:

```text
currentVersion = 0.1.0
version = 0.1.1
```

Do not download/install.

---

## 29. Step 21 — No-Update and Offline Tests

### No update

Verify equal/not-newer feed yields:

```text
null
```

not an error.

### Offline

Disable network temporarily.

Verify:
- updater check fails non-fatally
- Devventory still starts/works
- local features remain usable

Regression spots:
- Dashboard
- File Inventory
- Environment Tracker
- Agent Usage
- Settings
- system tray
- Quick Access

Where practical, also test invalid updater metadata.

---

## 30. Step 22 — Remove Temporary Harness

Before finalizing Phase 1, remove:
- temporary updater toast
- temporary verification component
- temporary debug invocation/status

Keep:
- updater plugin
- updater config
- public key
- endpoint
- `updater:allow-check`
- typed update model
- gateway
- unit tests

Phase 2 adds real UX.

---

## 31. Step 23 — Preserve Offline-First Rules

If engineering docs require clarification, add only a narrow exception:

```text
Project/application data synchronization remains out of scope.

The official Tauri updater may use HTTPS only for release metadata
and signed application update artifacts.

Updater failures must not block local app behavior.
```

Do not introduce a broad HTTP/cloud-sync exception.

---

## 32. Step 24 — Security Audit

Before finalization confirm:

```text
private signing key -> not in repo
signing password -> not in repo
release token -> not in app/source
tauri.conf.json -> public key only
latest.json -> public metadata only
```

Inspect staged/untracked files.

Never claim a key is safe without checking the repository diff/history relevant to the implementation.

---

## 33. Step 25 — Full Verification

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

Signed production build:

```powershell
npm run tauri build
```

Document every failure instead of skipping it.

---

## 34. Expected Permanent Diff

Expected areas:

```text
package.json
package-lock.json

src-tauri/
├── Cargo.toml
├── Cargo.lock
├── tauri.conf.json
├── capabilities/default.json
└── src/lib.rs

src/features/app-updater/
├── services/
│   ├── app-updater.gateway.ts
│   └── app-updater.gateway.test.ts
├── types/
│   └── app-update.types.ts
└── index.ts

.gitignore   # if needed
AGENTS.md    # if updater network rule needs clarification
```

No DB migration.

No Settings route.

No permanent shell UI.

---

## 35. Coding-Agent Guardrails

The implementing agent must:
- inspect before editing
- use current official Tauri docs
- follow feature-based colocation
- isolate Tauri updater API behind the feature gateway
- preserve tray/Quick Access/autostart/single-instance behavior
- preserve NSIS
- keep check-only permission
- never expose secrets
- never invent output filenames
- never fake update-test results
- never install an update in Phase 1
- never add semantic-release in Phase 1
- never add broad HTTP permissions
- never commit/push/create PR/release unless explicitly authorized by the user's coding workflow

When user action is genuinely required, prepare everything first and ask for the smallest possible action.

---

## 36. Phase 1 Acceptance Checklist

### Architecture
- [ ] latest `main` used
- [ ] no unrelated refactor
- [ ] updater feature under `src/features/app-updater`
- [ ] no direct updater logic in `AppLayout`
- [ ] no SQLite migration
- [ ] no Zustand updater store yet
- [ ] no permanent update UI yet

### Tauri
- [ ] updater frontend/Rust dependencies installed
- [ ] plugin initialized once
- [ ] `createUpdaterArtifacts: true`
- [ ] public key configured
- [ ] stable public endpoint configured
- [ ] main has `updater:allow-check`
- [ ] no download/install permission
- [ ] Quick Access has no updater permission
- [ ] NSIS remains target

### Signing
- [ ] coding agent ran key-generation command
- [ ] private key outside repository
- [ ] password not logged/committed
- [ ] secure backup confirmed
- [ ] `.sig` generated

### Release feed
- [ ] `devventory-releases` public
- [ ] `v0.1.1` test release exists
- [ ] `latest.json` valid
- [ ] `latest.json` anonymously readable
- [ ] installer anonymously readable
- [ ] signature matches generated `.sig`

### Detection
- [ ] updater-enabled `0.1.0` installed
- [ ] `0.1.0` detects `0.1.1`
- [ ] equal/not-newer returns `null`
- [ ] network failure differs from no-update
- [ ] no download/install occurs

### Regression
- [ ] offline operation still works
- [ ] tray works
- [ ] Quick Access works
- [ ] autostart unaffected
- [ ] single-instance unaffected
- [ ] local data unaffected
- [ ] lint passes
- [ ] format check passes
- [ ] typecheck passes
- [ ] unit tests pass
- [ ] e2e passes
- [ ] frontend build passes
- [ ] Rust fmt passes
- [ ] clippy passes
- [ ] Rust tests pass
- [ ] cargo check passes
- [ ] cargo audit passes
- [ ] signed Tauri build succeeds

---

## 37. Required Coding-Agent Completion Report

The coding agent must report:

```text
1. Branch and final working-tree status
2. Starting main commit
3. Updater frontend/Rust dependency versions
4. Tauri CLI version used for signing-key generation
5. Confirmation private key is outside repo
6. Confirmation signing backup checkpoint completed
7. Public updater endpoint
8. Final Tauri updater capability
9. Actual 0.1.0 installer/.sig filenames
10. Actual 0.1.1 installer/.sig filenames
11. Public latest.json URL
12. 0.1.0 -> 0.1.1 detection result
13. No-update result
14. Offline/error result
15. Frontend verification results
16. Rust verification results
17. Any deviations
18. Confirmation temporary harness removed
19. Confirmation no private key/password/token was exposed
20. Confirmation nothing was committed/pushed/released unless authorized
```

Never include private credentials in the report.

---

## 38. Stop Condition Before Phase 2

Do not begin Phase 2 until:

```text
A packaged updater-enabled Devventory 0.1.0
successfully detects a real signed Devventory 0.1.1
from the public devventory-releases feed,
without any GitHub credential in the installed app,
while Devventory remains fully usable offline.
```
