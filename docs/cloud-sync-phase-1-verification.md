# Cloud Sync Phase 1 verification

Verified on 2026-10-13 on `codex/cloud-sync-phase-1`. Source version remains `0.1.0`. No commit, push, application release, or mobile implementation was performed.

## Implemented and deployed

- Append-only desktop migration 16, transactional dirty scopes, persisted immutable uploads, revision/snapshot acknowledgement lineage, and deletion tombstones.
- Feature-owned project, tracker, validation, and current account/quota metadata exporters. No environment values, Vault values/notes, filesystem paths, asset contents, or notification-delivery records are part of the wire contracts.
- Windows Credential Manager publisher credential, asynchronous Rust transport, automatic retries, pause/enable, first-upload approval, manual synchronization, and explicit recovery.
- Authenticated Worker/D1 staged snapshots, read-only role, bounded requests, paginated reads, 24-hour superseded-snapshot retention followed by bounded cleanup, and disabled preview URLs.
- Live endpoint: `https://devventory-sync.devventory.workers.dev`. D1 migrations 0001 and 0002 are applied.

## Verification evidence

| Check                                                           | Result                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Frontend lint, formatting, TypeScript, build                    | PASS; existing large-chunk warning remains                                                                                        |
| Frontend unit suite                                             | 550 passed, 1 existing skipped                                                                                                    |
| Browser suite                                                   | 18 passed; updated cloud confirmation/error journey also passed independently                                                     |
| Worker contracts and real local D1 integration                  | 11 passed                                                                                                                         |
| Worker TypeScript                                               | PASS                                                                                                                              |
| Rust formatting, Clippy all targets/features, compilation check | PASS                                                                                                                              |
| Complete Rust suite                                             | 148 passed with `cargo test --offline` using the repository's one-test-thread default                                              |
| Cross-language Rust → HTTP Worker → local D1 acceptance         | PASS, including durable offline edits, automatic reconnect, matrix states, rule targets, restored lineage detection, and deletion |
| Generated token/hash scan                                       | No matches in 1,153 tracked or non-ignored source files; credential files are ignored                                             |
| Existing desktop migrations                                     | Unchanged; published migration 14 checksum guard passed; migration 16 uses LF                                                     |

The initial concurrent Rust run hit existing Vault interactive-timing assertions under competing load. A follow-up local-CI investigation reproduced 147 passes and one Vault setup latency failure with default concurrent test bodies, while the same Stronghold test passed in isolation. The repository now defaults Rust test bodies to one thread through `.cargo/config.toml`; the subsequent full `cargo test --offline` run passed all 148 tests in 57.65 seconds. Compilation remains parallel, and no tests, latency assertions, or encryption parameters were changed. Historical migration fixtures were updated for migration 16.

A fresh-context substitute for the unavailable shipped UI finish reviewer returned PASS with zero open findings after fixing dialog-local enable/recovery error feedback.

## Live cloud acceptance

Missing authentication returned 401; publisher workspace/device identity matched; the reader could read metadata but publication returned 403. The user approved and enabled the first upload in the development app.

Authenticated paginated reads confirmed:

| Current visible projection | Count |
| -------------------------- | ----- |
| Projects                   | 6     |
| Environments               | 14    |
| Matrix keys                | 159   |
| Rules                      | 6     |
| Issues                     | 141   |
| Agent accounts             | 18    |
| Quota windows              | 25    |

Sampled matrix cells included present, absent, and duplicate states. No prohibited value/path/Vault-note fields were found in read responses; verification printed counts, not record contents or tokens.

The first-upload preview reported 161 stored key definitions. That count is not the visible matrix count: the existing matrix builder excludes unassociated definitions and includes enabled-rule-only keys. Cloud export reuses that builder rather than publishing every retained definition.

## Audit findings and remaining acceptance

- `npm audit`: 20 dependency findings (1 critical, 16 high, 3 moderate) remain in existing release/build/test dependencies. Examples include unchanged Handlebars 4.7.9 in release tooling. New cloud-tooling advisories were removed by updating the pinned tooling. This is not a clean repository-wide dependency audit; remediation needs its own reviewed change, not a forced bulk upgrade.
- `cargo audit`: no vulnerability findings; 10 informational warnings remain, including existing unmaintained dependencies, glib 0.18.5 unsoundness, and yanked chacha20 0.10.1. These packages/versions were already in the baseline lockfile.
- Still required in production: disconnect the network, append `cloud-sync-offline-test` to a test project's description, completely quit and reopen the same development build while offline, reconnect without pressing Sync now, and confirm automatic publication. Restore the description afterward.

Production acceptance is not complete until that last manual scenario passes. Use the same new development build throughout this test; an older installed application may not understand the upgraded local database. Keep the existing pre-migration backup. Cloud metadata is not a full application backup.

Setup and recovery instructions: [Cloud Sync setup](cloud-sync-phase-1-setup.md).
