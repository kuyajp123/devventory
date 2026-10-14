# ADR-0002: Use Firebase identity with isolated Cloudflare workspaces

## Status

Accepted by the user. Implemented and tested with synthetic Firebase signatures and local D1; real-user production acceptance is a separate checkpoint.

## Date

2026-10-13

## Context

The existing optional Cloud Sync feature publishes allowlisted desktop metadata to one private Cloudflare Worker/D1 workspace. The user wants email/password accounts and isolated cloud workspaces for future Devventory users, without a credit card, while keeping SQLite offline-first and preparing for a later mobile client.

WorkOS AuthKit was considered but requires billing information for production. Firebase Authentication supports basic email/password authentication on the no-card Spark plan and documented REST APIs suitable for the existing Rust gateway boundary.

## Decision

Use Firebase for identity only and extend, rather than replace, Cloud Sync. Verify Firebase ID tokens in the Worker and resolve ownership from their verified UID. Allocate one workspace per account and preserve one publishing desktop per workspace. Keep paths, values, Vault data, and assets local.

Persist refresh/device credentials in Windows Credential Manager, not SQLite or browser storage. Keep local app access independent of sign-in. Preserve the existing queue, snapshot protocol, revision checks, retries, and restored-database recovery.

Derive device credentials with HMAC-SHA-256 from a randomly generated server-only 256-bit key and the workspace/device/generation/registration identity. D1 stores registration hashes, not raw credentials. Deterministic receipts let interrupted registrations retry without rotating credentials. Explicit publisher replacement changes the generation and invalidates the preceding device credential.

Adopt the existing private workspace only through verified identity plus proof of the existing publisher credential and explicit confirmation. Never let the first signup claim existing metadata. Retire legacy-token access for that workspace only after its safe claim.

## Alternatives considered

### WorkOS AuthKit

Not selected because production requires billing information, contrary to the no-card requirement. Its hosted UI would reduce UI integration work.

### Replace D1 with Firebase databases

Rejected because only identity is changing. Replacing already implemented metadata persistence and sync would expand scope and discard existing work.

### Add only a login screen

Rejected because the current fixed-workspace bearer-token authorization would still lack user isolation. Identity verification and workspace ownership must be enforced by the server.

## Consequences

- Sign-in/UI/session integration and new server ownership/device contracts are required.
- Append-only D1 and desktop migrations preserve the existing data and compatibility history.
- Cloud Sync normal setup becomes account-based rather than exposing raw workspace/device/token configuration to users.
- Firebase quotas still apply. Spark does not mean unlimited capacity or a permanent service guarantee.
- Mobile, teams, bidirectional edits, multiple simultaneous publishers, paid services, and credential-value synchronization remain out of scope.

See [the implementation plan](../firebase-authentication-implementation-plan.md) for contracts, acceptance conditions, source references, and the review gate.

See [the operating guide](../firebase-authentication-setup.md) for deployment ordering, safe legacy adoption, and production acceptance.
