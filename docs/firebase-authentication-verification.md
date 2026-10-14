# Firebase authentication verification

Checkpoint: 2026-10-14, branch `codex/authkit-sign-in`, based on the saved Cloud Sync checkpoint `d16cc57884909235df273babba379844cc784db8`. Implementation is uncommitted and unpushed. Application source version remains `0.1.0`; no application release, tag, or signing-key rotation was performed.

## Automated results

| Check                                                                   | Result                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Frontend lint, format check, typecheck                                  | Pass                                                                                                               |
| Frontend production build                                               | Pass; existing Vite large-chunk warning remains                                                                    |
| Full frontend unit suite (two workers)                                  | 565 passed, 1 skipped, 0 failed across 113 files                                                                   |
| Focused Cloud Sync UX follow-up                                         | 15 passed, 0 failed; includes empty-queue, upload progress, pending, unknown-error and failed-status-refresh cases |
| Full browser journeys                                                   | 20 passed, 0 failed, two workers                                                                                   |
| Worker typecheck, local D1 integration and actual-workerd fetch tests   | 31 passed, 0 failed                                                                                                |
| Rust fmt, Clippy all targets/features with warnings denied, cargo check | Pass                                                                                                               |
| Full Rust tests including Vault and local D1 publisher integration      | 157 passed, 0 failed; binary/doc tests also pass                                                                   |
| Git-hook tests / release tooling regression tests                       | 6 / 46 passed; tests do not publish or push                                                                        |
| UI finish review                                                        | Ship after fixing account-control availability during sync errors and field-specific accessible error associations |
| Git whitespace and migration compatibility checks                       | Pass; desktop migrations 1–16 and D1 migrations 1–2 unchanged; new desktop migration 17 is LF                      |

The latest full unit run includes the final reconnect regression and Cloud Sync UX follow-up. Screenshots use synthetic accounts/data at desktop and the existing 1000×650 minimum size. The prior authentication UI detector returned no findings; a fresh reviewer validated those fixes. The installed finish-reviewer role was unavailable, so a fresh read-only default reviewer was substituted. The subsequent status follow-up received scoped code and screenshot review. No new visual identity or global redesign was introduced.

## Security and ownership proof

Worker tests use real RSA signatures with synthetic identities and disposable D1. They cover wrong issuer/project, expiry, timestamps, verification, key ID/algorithm/signature, workspace idempotency/isolation, actual staged project publication, foreign snapshot/cursor/device/recovery requests, publisher registration races, explicit replacement and reactivation, old-credential rejection, and protected legacy adoption. Existing chunk allowlists, tombstones, atomic activation, acknowledgement idempotency, and bounded cleanup tests still pass.

Rust tests prove wrong-password errors, token-free public state, native-only refresh persistence, restart/single-flight rotation, temporary versus revoked-refresh behavior, numeric project-number validation, persistence of rotation before a failed profile lookup, and sign-out even when cloud SQLite is unavailable. The existing durable queue and same-destination ownership-adoption tests preserve prepared uploads and revisions. Browser journeys prove verification controls, explicit linking/first-upload approval, sign-out pause, and cross-account gating.

Exact-value audits compared the four original private cloud token/hash values and the new server device-signing key against tracked/untracked source candidates. No matches were found. Ignored credential files are not tracked. `src-tauri/firebase-public.json` intentionally contains a public Firebase client API key, not a service-account private key. Account passwords/tokens are not returned to React or persisted in general settings/SQLite/browser storage; legacy configuration also no longer retains the publisher token in mutation-cache variables.

## Dependency audit: existing debt, not a clean audit

`npm audit` exits 1 with **20 findings: 3 moderate, 16 high, 1 critical**. Existing package versions are unchanged from the checkpoint; the only added npm package is pinned `jose@6.2.12`, which has no reported finding. The existing critical report is for Handlebars in the release-tooling dependency graph. No automatic audit fix or unrelated upgrade was performed. Address this debt separately before treating the repository as audit-clean.

`cargo audit --json` exits 0 with no vulnerabilities and **10 warnings**: unmaintained bincode, paste, proc-macro-error and five UNIC packages; glib 0.18.5 unsoundness; yanked chacha20 0.10.1. Every warned package/version existed at the checkpoint. Authentication adds only reqwest query/form features and their serde_urlencoded/ryu dependencies; neither appears in the warning report. Existing libsodium Windows linker/PDB warnings remain in Rust test builds; Clippy passes with warnings denied.

## Production deployment and preservation

- Configured a new random server-only device-signing secret through Wrangler stdin. Existing legacy publisher/reader secrets and updater signing identity were not rotated.
- Applied only D1 migration `0003_account_workspaces.sql` to existing `devventory-sync` database `98a2797c-88ba-4840-8420-af5af3241f46`.
- Deployed the authentication extension, then its narrowly scoped certificate-fetch correction. Current Worker version: `41fe33a5-5ed6-4108-856b-d68c73498df5` at `https://devventory-sync.devventory.workers.dev`; schedule and legacy IDs unchanged.
- Before and after deployment, anonymous metadata requests returned 401, the existing publisher/reader checks succeeded, and reader publication was rejected. Six projects remained visible on the first page; record contents/tokens were not printed.
- A production rejection probe exposed an incompatible Workers `fetch` redirect option (503 instead of 401): `redirect: 'error'` works in Node but is rejected by workerd. Changed only the certificate request to `manual` and continued rejecting every non-2xx response. Two failing-then-passing tests execute the bundled production Worker inside actual workerd and prove requests reach only the pinned Google origin, do not forward authorization, and never follow redirects. After redeployment, a forged token with a real Google certificate key ID returns 401/UNAUTHORIZED. This proves the rejection path, not a valid-user claim.
- Read-only D1 counts immediately after deployment showed zero owned workspaces and zero registered devices. No automatic adoption or data rebuild occurred.

## User-entered production acceptance

The user confirmed real Firebase account creation and sign-in, with the account visible in Firebase Authentication. Their first existing-workspace connection attempt returned the safe generic cloud error during the certificate-fetch failure. After the server correction and retry, read-only checks on 2026-10-14 confirm:

- Local sync is enabled and account-linked, with zero pending scopes and no recorded blocked/error code.
- The original workspace now has one owner and one active publishing desktop; six projects remain visible in D1. The checks wrote zero cloud rows.
- The local last successful sync is `2026-10-13T05:31:48.136Z`, preserved from the existing mirror. An idle queue is not evidence of a new authenticated upload.

Protected adoption and the enabled idle state are confirmed. The user also confirmed the updated development UI shows disabled **Up to date** with zero pending updates. A newly authenticated metadata upload, offline/reconnect across restart, and second-account production isolation still require manual acceptance.

### Idle/progress/error UX follow-up

The user reported unclear feedback despite an empty queue. The Settings action now changes between disabled **Up to date**, disabled **Nothing to sync**, enabled **Sync now** for pending changes, and disabled **Syncing…** during work. It exposes unknown problem codes through a safe generic warning and failed cached-status refresh through **Retry status** rather than stale success. No backend, database, cloud resource, polling interval, or synchronization behavior was changed for this follow-up.

Six regression tests failed before the narrow frontend patch, then the complete Cloud Sync feature suite passed (15 tests). All 20 browser journeys pass, including a synthetic queued upload through progress/success and re-enabling the action after a new queued change; that journey recorded no browser console/page errors. Desktop and 1000×650 screenshots use synthetic data only and show readable, unclipped status controls using the existing secondary-button styling. Lint, format check, frontend typecheck/build, and Git whitespace checks pass.

The first browser run overlapped the production build and hit two initial navigation timeouts. Its new polling assertion also needed an active Settings tab because React Query pauses interval refresh in hidden tabs. The test now brings its page to the front for that assertion; no production polling setting was changed. The complete browser rerun without the build passed. An initial concurrent lint scan raced Playwright's cleanup of `test-results`; lint passed after browser cleanup completed.

## Remaining manual acceptance

Continue from the already linked, enabled original profile. Edit safe synthetic metadata and confirm a new authenticated upload updates the cloud mirror. Then test offline edits across full restart/reconnect and an isolated second account/profile. Do not repeat adoption or rebuild cloud data to test the status UI. See [the operating guide](firebase-authentication-setup.md). Do not send passwords, ID/refresh/device tokens, ignored credential files, or secret hashes in chat.

Synthetic tests and preserved legacy access do not prove those real-user flows. No mobile work starts before this acceptance checkpoint succeeds.
