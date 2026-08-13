# ADR-0001: Use a recovery-first dual-path release transaction

## Status

Accepted

## Date

2026-08-13

## Context

Devventory source is private, while updater assets must remain anonymously accessible from the public `devventory-releases` repository. GitHub-hosted Actions is the default release environment, but the maintainer needs a local Windows fallback when Actions is unavailable or its quota is exhausted.

Git tags are semantic-release's release boundary. If a private source tag is created before the corresponding public draft is published, a retry that plans first can incorrectly skip the unfinished version. Publication spans two repositories and cannot be one atomic GitHub operation.

## Decision

Use one shared release engine for hosted and local execution. Every invocation acquires a cross-path lease and reconciles unfinished transactions before semantic-release calculates anything new.

The transaction order is:

1. build and validate;
2. create a marked public draft;
3. upload and digest-verify exactly three assets;
4. create the immutable private source tag;
5. publish the public release;
6. anonymously verify updater downloads.

semantic-release is restricted to dry-run version and release-note planning. The custom engine owns version handoff, tags, cross-repository publication, and recovery.

Transaction authority is composite: the public published state establishes availability, the private tag establishes provenance and version history, the draft marker establishes ownership and intent, and asset digests establish payload identity. Conflicts fail closed and stable releases are never repaired by overwriting assets.

## Alternatives considered

### Plan with semantic-release before recovery

Rejected because a previously created private tag can cause semantic-release to report no release or calculate only commits after an unpublished version.

### Publish before creating the private source tag

Rejected because users could observe a public updater release before immutable private source provenance exists. It merely reverses the cross-repository partial-failure problem.

### Separate hosted and local release scripts

Rejected because recovery and safety rules could drift. Both entry points must execute identical state validation and publication code.

### Automatically replace mismatched draft assets

Rejected because an unexpected digest can indicate an incorrect build, signing identity, source SHA, or external modification. Automatic replacement would destroy evidence needed for safe investigation.

## Consequences

- A valid unfinished version blocks every newer version until recovery completes.
- If `main` advances, recovery publishes the older exact source SHA before planning from its recovered tag to the pinned current `main` SHA.
- The private source repository gains a temporary `automation/release-lock` branch during a release.
- A force-stopped process can require explicit stale-lease cleanup after verifying no release is active.
- The first automated invocation bootstraps private `v0.1.2` at the accepted Phase 2 source commit after validating the public legacy release.
- Tests cover reconciliation conflicts, recovery ordering, SemVer rules, metadata, GitHub lease ownership, and isolated version handoff.
