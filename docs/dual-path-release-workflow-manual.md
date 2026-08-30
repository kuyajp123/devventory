# Devventory Dual-Path Release Workflow Manual

## Purpose

Devventory has two release paths that execute the same recovery-first release engine:

1. **Default:** `.github/workflows/release.yml` runs after `main` changes.
2. **Fallback:** `npm run release:local` runs explicitly on the maintainer's Windows computer.

Normal feature-branch pushes never start the release workflow. The protected-`main` pull-request rule is the repository control that ensures an ordinary `main` update comes from a merged pull request.

Both paths publish updater assets to the public [`kuyajp123/devventory-releases`](https://github.com/kuyajp123/devventory-releases) repository while source tags remain in the private `kuyajp123/devventory` repository.

## Release commands

Run commands from:

```powershell
cd C:\Users\Paul\Projects\devventory
```

| Command                      | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `npm run release:plan`       | Read-only recovery/next-release preview from a clean, current `main`.   |
| `npm run release:local`      | Interactive signed Windows release fallback with exact confirmation.   |
| `npm run release:hosted`     | Non-interactive GitHub Actions entry point; guarded to `main`.          |
| `npm run test:release-tools` | Fast release-state, SemVer, metadata, GitHub-client, and version tests. |

`release:local` prompts securely for the updater signing-key password. It then shows the source SHA, version, public installer URL, and each artifact's exact size and SHA-256 digest before accepting the phrase `publish v<version>`. To bypass local quality gate tests and build immediately, pass `-- --skip-ci` (or `powershell.exe -File scripts/release-local.ps1 -SkipCi`).

If recovery is required, the local command separately requires `recover v<version>` before changing remote state.

## GitHub repository configuration

The private source repository needs these Actions secrets:

| Secret                                       | Value and scope                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `RELEASE_TOKEN`                              | Fine-grained token limited to `kuyajp123/devventory-releases` with repository Contents read and write. |
| `TAURI_SIGNING_PRIVATE_KEY`                  | Complete contents of the existing updater private-key file.                                            |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`         | Password created when that updater key was generated.                                                   |

The workflow's repository-scoped `GITHUB_TOKEN` creates the private source tag and the cross-path release lease. It has `contents: write` only for the source repository. `RELEASE_TOKEN` cannot unlock the Tauri signing key, and the signing password cannot authenticate to GitHub.

Never print, commit, paste into documentation, or upload the private key, password, or tokens as release assets.

## Version behavior

The planner uses Conventional Commits:

| Commit effect                        | Version result |
| ------------------------------------ | -------------- |
| `fix:`                               | Patch          |
| `feat:`                              | Minor          |
| `feat!:` or a breaking-change footer | Major          |
| `docs:`, `chore:`, `ci:`, `test:`    | No release     |

Breaking changes use standard SemVer, so a breaking release after `0.1.2` becomes `1.0.0`.

The tracked source stays at `0.1.0`. The release version is applied only inside a detached temporary worktree to:

- `package.json`;
- the root entry in `package-lock.json`;
- `src-tauri/Cargo.toml`;
- Devventory's entry in `src-tauri/Cargo.lock`.

The temporary checkout is removed after the signed artifacts are loaded and validated.

## One-time `v0.1.2` baseline

The public `v0.1.2` Phase 2 acceptance release predates the automated marker format. Its accepted private source commit is:

```text
06d134512f16daea759733c083d8264ebdc0bb5b
```

Before calculating the first automated version, the engine verifies that the public `v0.1.2` release has exactly the installer, signature, and `latest.json`. If the private `v0.1.2` source tag is missing, the engine treats that as a recovery action and creates the tag at the accepted commit. A tag at any other SHA stops the release.

The legacy `v0.1.1` and `v0.1.2` public releases are never edited or overwritten.

## Recovery-first execution order

Every invocation performs these steps in order:

1. Pin and validate the current `origin/main` SHA.
2. Acquire the shared private-repository release lease.
3. Read all private `v*` source tags.
4. Authenticated-list public releases and drafts.
5. Reconcile any engine-managed unfinished transaction.
6. Stop on every marker, tag, SHA, asset, or digest conflict.
7. Finish a valid older transaction before invoking semantic-release.
8. Refresh private tags after recovery.
9. Ask semantic-release for the next version and notes in dry-run mode.
10. Exit successfully if no qualifying commits exist.
11. Run the complete local quality gate.
12. Build the signed NSIS installer from the pinned SHA.
13. Create a public draft carrying the transaction marker and expected manifest.
14. Upload and verify exactly the installer, `.sig`, and `latest.json`.
15. Create the private source `v<version>` tag.
16. Publish the public release.
17. Anonymously verify `latest.json`, the signature, and installer access.
18. Release the shared lease.

semantic-release only calculates the version and release notes. It does not create tags, edit the source checkout, or publish releases.

### Tooling advisory status (2026-08-13)

`npm audit` reports five moderate and two high transitive findings under semantic-release's bundled `@semantic-release/npm`/`npm` dependency tree. Devventory does not enable that npm-publication plugin: `release.config.mjs` loads only the commit analyzer and release-notes generator, while the custom release engine owns GitHub tags and assets. The latest semantic-release v25 still carries this tree, and testing the latest v24 increased the high findings, so no misleading override or downgrade is committed. Registry signatures remain a separate required verification, and these upstream advisories should be rechecked when semantic-release or npm publishes a compatible fix.

## Transaction authority

No single record proves the complete state:

| Record                                    | Authority                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Published public release                  | Whether users can receive the version.                                     |
| Private `v<version>` tag                  | Immutable source provenance and the next semantic-release baseline.        |
| Engine marker in the public release body  | Transaction ownership, version, source SHA, date, and expected manifest.   |
| Asset size and SHA-256 digest             | Exact payload identity.                                                    |
| `latest.json` plus the complete `.sig`     | Updater version, URL, platform, and cryptographic-signature agreement.     |

Automatic recovery requires all available records to agree. Existing assets are never overwritten. A partial pre-tag draft can upload a missing asset only when rebuilding the exact pinned source produces the size and digest already stored in the marker.

## Expected failure behavior

| Observed state                                      | Engine behavior                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| Matching draft, verified assets, no private tag     | Create the exact private tag, then publish.                            |
| Matching draft and matching private tag             | Verify again, then publish before planning anything newer.             |
| Partial draft without a private tag                  | Exact rebuild; upload only matching missing assets.                    |
| Private tag SHA differs from marker SHA              | Stop without moving or deleting the tag.                              |
| Existing asset size or digest differs                | Stop without replacing the asset.                                     |
| Published future release has no engine marker        | Stop; do not assume it belongs to this engine.                         |
| More than one managed unfinished draft               | Stop for manual investigation.                                        |
| Public release published but anonymous checks fail   | Stop; later invocations recheck the newest managed published release. |
| `main` advances after an older transaction failed    | Finish the older version, refresh tags, then calculate from that tag. |

## Shared lease and stale-lock recovery

Hosted Actions concurrency serializes hosted runs. A private Git reference provides the additional shared lease needed to exclude `release:local`:

```text
refs/heads/automation/release-lock
```

Normal completion and handled failures delete only the lease whose SHA still matches the current invocation. A force-stopped runner or powered-off computer can leave a stale lease.

First verify that no hosted release is active and no local release terminal is running:

```powershell
gh run list --repo kuyajp123/devventory --workflow release.yml --status in_progress
gh api repos/kuyajp123/devventory/git/ref/heads/automation/release-lock --jq '.object.sha'
```

Only after confirming both release paths are idle, remove the stale lease:

```powershell
gh api --method DELETE repos/kuyajp123/devventory/git/refs/heads/automation/release-lock
```

Then rerun the failed hosted workflow or `npm run release:local`. Never delete a version tag to clear the lease.

## Local fallback requirements

The fallback refuses to run unless:

- Windows is in use;
- the current branch is exactly `main`;
- the working tree is clean;
- local `HEAD` exactly equals `origin/main` after fetching;
- GitHub CLI authentication is available, unless both required tokens are already in environment variables;
- the existing updater private key exists at `%USERPROFILE%\.tauri\devventory-updater.key` or is passed through `-SigningKeyPath`;
- Playwright, Rust quality components, and `cargo-audit` are installed.

The default key can be overridden directly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/release-local.ps1 `
  -SigningKeyPath 'D:\secure-backup\devventory-updater.key'
```

## What not to do

- Do not run `release:hosted` manually outside GitHub Actions.
- Do not release from a feature branch.
- Do not delete or move an existing `v<version>` tag to make a retry pass.
- Do not replace a mismatched draft or stable asset automatically.
- Do not modify `v0.1.1` or `v0.1.2`.
- Do not rotate the updater signing key as ordinary release troubleshooting.
- Do not use `--no-verify` as evidence that a release candidate passed local CI.

## Official references

- [semantic-release configuration and dry-run](https://semantic-release.gitbook.io/semantic-release/usage/configuration)
- [semantic-release JavaScript API](https://semantic-release.gitbook.io/semantic-release/developer-guide/js-api)
- [semantic-release plugin lifecycle](https://semantic-release.gitbook.io/semantic-release/usage/plugins)
- [GitHub Releases REST API](https://docs.github.com/en/rest/releases/releases)
- [GitHub Git references REST API](https://docs.github.com/en/rest/git/refs)
- [GitHub Actions token authentication](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [Tauri updater signing and static JSON](https://v2.tauri.app/plugin/updater/)
