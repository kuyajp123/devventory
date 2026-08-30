# Devventory CI & Release Command Cheatsheet

Run commands from:

```powershell
cd C:\Users\Paul\Projects\devventory
```

---

## 📑 Table of Contents

- [🧪 Local Testing / CI](#-local-testing--ci)
  - [Run the complete local CI](#run-the-complete-local-ci)
  - [See CI stages without running them](#see-ci-stages-without-running-them)
  - [Test only the release tooling](#test-only-the-release-tooling)
  - [Test only the Git hook policies](#test-only-the-git-hook-policies)
- [🚀 Normal Git Push](#-normal-git-push)
  - [First push of a new branch](#first-push-of-a-new-branch)
  - [Delete a merged remote feature branch](#delete-a-merged-remote-feature-branch)
- [🧪 Safely Test the Pre-Push Hook](#-safely-test-the-pre-push-hook)
- [🪝 Check Git Hooks](#-check-git-hooks)
- [🌿 Start a Feature Branch](#-start-a-feature-branch)
- [🔍 Check Changes Before Commit](#-check-changes-before-commit)
- [💾 Commit](#-commit)
- [🔀 After a PR Is Merged](#-after-a-pr-is-merged)
- [🔄 If main Changed While Working on a Feature](#-if-main-changed-while-working-on-a-feature)
- [📦 Release Commands](#-release-commands)
  - [Preview the Next Release](#preview-the-next-release)
  - [🖥️ Local Production Release](#️-local-production-release)
  - [☁️ Hosted Release](#️-hosted-release)
- [🏷️ Release Version Rules](#️-release-version-rules)
- [🔐 Release Requirements](#-release-requirements)
- [🔑 Default Tauri Signing Key](#-default-tauri-signing-key)
- [🛠️ New Checkout / Worktree Setup](#️-new-checkout--worktree-setup)
- [🔒 Check for an Active Hosted Release](#-check-for-an-active-hosted-release)
- [🔒 Check the Release Lock](#-check-the-release-lock)
- [⚠️ Remove a Stale Release Lock](#️-remove-a-stale-release-lock)
- [🚨 Bypass Local Push CI](#-bypass-local-push-ci)
- [⭐ Commands You'll Probably Use Most](#-commands-youll-probably-use-most)
- [🧠 Quick Mental Model](#-quick-mental-model)

---

## 🧪 Local Testing / CI

### Run the complete local CI

```powershell
npm run ci:local
```

**Does:** Runs the complete Devventory quality gate.

Includes:

- ESLint
- formatting check
- TypeScript typecheck
- unit tests
- release-tool tests
- Playwright E2E tests
- frontend production build
- Rust formatting
- Clippy
- Rust tests
- Cargo check
- Cargo audit

**Important:** The suite stops on the first failed stage.

---

### See CI stages without running them

```powershell
npm run ci:local -- -ListOnly
```

**Does:** Shows the configured local CI stages only.

Useful when you want to see what will run before starting the full suite.

---

### Test only the release tooling

```powershell
npm run test:release-tools
```

**Does:** Runs the faster tests covering things such as:

- release state
- recovery behavior
- SemVer calculations
- metadata
- GitHub release logic
- version handoff

### Test only the Git hook policies

```powershell
npm run test:hooks
```

**Does:** Verifies normal pushes, deletion-only pushes, mixed pushes, and protected `main` deletion behavior without pushing anything.

---

## 🚀 Normal Git Push

```powershell
git push
```

**Does:**

```text
git push
   ↓
pre-push hook
   ↓
npm run ci:local
   ↓
PASS → push continues
FAIL → push canceled
```

You normally **do not need to run `npm run ci:local` manually before a code push**, because `git push` automatically invokes it. A push that only deletes remote feature branches skips local CI.

---

### First push of a new branch

```powershell
git push -u origin feature/my-feature
```

**Does:** Creates the remote branch and runs the complete local CI before the branch is uploaded.

Future pushes can simply use:

```powershell
git push
```

### Delete a merged remote feature branch

```powershell
git push origin --delete feature/my-feature
```

**Does:** Deletes the remote feature branch without running local CI. Remote `main` deletion is blocked locally and remains protected by the GitHub ruleset.

---

## 🧪 Safely Test the Pre-Push Hook

```powershell
git push --dry-run origin HEAD:refs/heads/local-ci-hook-test
```

**Does:** Exercises the real `pre-push` hook without actually creating the remote branch.

Check afterward:

```powershell
git ls-remote --heads origin local-ci-hook-test
```

Expected:

```text
(no output)
```

---

## 🪝 Check Git Hooks

```powershell
git config --local --get core.hooksPath
```

Expected:

```text
.githooks
```

If `.githooks` is missing:

```powershell
npm run prepare
```

**Does:** Reconfigures the current checkout to use Devventory's tracked Git hooks.

---

## 🌿 Start a Feature Branch

```powershell
git switch main
git pull --ff-only
git switch -c feature/my-feature
```

**Does:**

1. switches to `main`
2. gets the newest remote `main`
3. creates a new feature branch

---

## 🔍 Check Changes Before Commit

```powershell
git status --short
```

Shows changed/untracked files.

```powershell
git diff
```

Shows your code changes.

---

## 💾 Commit

```powershell
git add <files>
git commit -m "feat(scope): description"
```

Example:

```powershell
git commit -m "feat(worktree): add worktree manager"
```

Committing automatically runs:

```text
pre-commit
   ↓
lint-staged

commit-msg
   ↓
commitlint
```

Common commit types:

```text
feat:     new feature
fix:      bug fix
docs:     documentation
test:     tests
chore:    maintenance
ci:       CI changes
```

---

## 🔀 After a PR Is Merged

Update your local `main`:

```powershell
git switch main
git pull --ff-only
```

**Does:** Makes your local `main` match the newly merged GitHub `main`.

---

## 🔄 If `main` Changed While Working on a Feature

```powershell
git switch feature/my-feature
git fetch origin
git merge origin/main
git push
```

**Does:**

```text
Latest main
     ↓
merge into feature
     ↓
resolve conflicts if any
     ↓
git push
     ↓
full local CI runs again
```

---

## 📦 Release Commands

### Preview the Next Release

```powershell
npm run release:plan
```

**Does:** Read-only release planning.

It checks the current release state and determines what release would happen without publishing it.

Think of it as:

```text
"What would Devventory release right now?"
```

It can determine whether the next version should be something like:

```text
No release
v0.1.3
v0.2.0
v1.0.0
```

Run this from a clean, current `main`.

---

### 🖥️ Local Production Release

```powershell
npm run release:local
```

#### ⚡ Fast Release (Skip Local CI Tests)
```powershell
# Using the PowerShell script directly:
powershell.exe -File scripts/release-local.ps1 -SkipCi

# Or passing through npm:
npm run release:local -- --skip-ci
```

**Does:** Executes the real Devventory release process from your Windows computer.

Use this when:

- GitHub Actions is unavailable;
- your Actions quota is exhausted;
- the hosted release needs a controlled local fallback.

Flow:

```text
release:local
      ↓
Verify main
      ↓
Verify clean repository
      ↓
Verify origin/main
      ↓
Acquire release lock
      ↓
Recover unfinished release if needed
      ↓
Calculate version
      ↓
Run quality gate
      ↓
Build signed installer
      ↓
Verify artifacts
      ↓
Show release information
      ↓
Ask for confirmation
      ↓
Publish
```

You will be asked for your Tauri signing-key password securely.

Before publishing, it requires an exact confirmation such as:

```text
publish v0.2.0
```

---

### ☁️ Hosted Release

```powershell
npm run release:hosted
```

**DO NOT normally run this yourself.**

This is the entry point intended for:

```text
GitHub Actions
.github/workflows/release.yml
```

Normal flow:

```text
PR merged
   ↓
main changes
   ↓
GitHub Actions
   ↓
release.yml
   ↓
release:hosted
```

---

## 🏷️ Release Version Rules

Your Conventional Commits determine the version.

```text
fix:
```

Example:

```text
0.1.2 → 0.1.3
```

---

```text
feat:
```

Example:

```text
0.1.2 → 0.2.0
```

---

```text
feat!:
```

or a breaking-change footer:

```text
0.1.2 → 1.0.0
```

---

These normally produce **no release**:

```text
docs:
chore:
ci:
test:
```

---

## 🔐 Release Requirements

Before running:

```powershell
npm run release:local
```

make sure:

```text
✓ Windows
✓ branch = main
✓ working tree clean
✓ HEAD = origin/main
✓ GitHub authentication available
✓ Tauri updater private key available
✓ Playwright installed
✓ Rust components installed
✓ cargo-audit installed
```

---

## 🔑 Default Tauri Signing Key

Expected location:

```text
%USERPROFILE%\.tauri\devventory-updater.key
```

To use another signing-key file:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/release-local.ps1 `
  -SigningKeyPath 'D:\secure-backup\devventory-updater.key'
```

---

## 🛠️ New Checkout / Worktree Setup

Install Node dependencies:

```powershell
npm ci
```

Install Playwright Chromium:

```powershell
npm exec playwright install chromium --only-shell
```

Install required Rust components:

```powershell
rustup component add clippy rustfmt
```

Install Cargo Audit:

```powershell
cargo install cargo-audit --locked
```

Check hooks:

```powershell
git config --local --get core.hooksPath
```

Expected:

```text
.githooks
```

---

## 🔒 Check for an Active Hosted Release

```powershell
gh run list --repo kuyajp123/devventory --workflow release.yml --status in_progress
```

**Does:** Checks whether the GitHub-hosted release workflow is currently running.

Useful before troubleshooting a potentially stale release lock.

---

## 🔒 Check the Release Lock

```powershell
gh api repos/kuyajp123/devventory/git/ref/heads/automation/release-lock --jq '.object.sha'
```

**Does:** Checks the shared release lock used to prevent hosted and local releases from running simultaneously.

---

## ⚠️ Remove a Stale Release Lock

Only after confirming:

```text
NO GitHub release workflow is running
AND
NO local release process is running
```

run:

```powershell
gh api --method DELETE repos/kuyajp123/devventory/git/refs/heads/automation/release-lock
```

Then retry:

```powershell
npm run release:local
```

or rerun the hosted GitHub workflow.

**Never delete a `v<version>` Git tag to clear the release lock.**

---

## 🚨 Bypass Local Push CI

```powershell
git push --no-verify
```

⚠️ **Emergency only.**

This skips the `pre-push` CI.

If you deliberately use it, manually run:

```powershell
npm run ci:local
```

Do not treat `--no-verify` as proof that a release candidate passed CI.

---

## ⭐ Commands You'll Probably Use Most

```powershell
# Check repository
git status --short

# Complete local test
npm run ci:local

# Push code + automatically run local CI
git push

# Delete a merged remote feature branch without local CI
git push origin --delete feature/my-feature

# Update local main
git switch main
git pull --ff-only

# Preview possible release
npm run release:plan

# Release locally when GitHub Actions is unavailable
npm run release:local

# Test release tooling only
npm run test:release-tools

# Test Git hook policies only
npm run test:hooks
```

---

## 🧠 Quick Mental Model

### Testing

```text
git push
   ↓
LOCAL CI
   ↓
GitHub
```

### Normal release

```text
Merge PR
   ↓
main
   ↓
GitHub Actions
   ↓
release:hosted
   ↓
Release
```

### GitHub Actions unavailable / quota exhausted

```text
Merge PR
   ↓
main
   ↓
git pull locally
   ↓
npm run release:local
   ↓
Release
```

### Want to know what would release without publishing?

```powershell
npm run release:plan
```

### Want to test everything without pushing?

```powershell
npm run ci:local
```

### Want to push normally?

```powershell
git push
```

The CI runs automatically.
