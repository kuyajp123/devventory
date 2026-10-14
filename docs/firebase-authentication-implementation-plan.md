# Firebase Authentication and isolated Cloud Sync workspaces

## Status and objective

Approved by the user; implemented and deployed as of 2026-10-14, with user-entered production acceptance pending. Branch: `codex/authkit-sign-in` (the historical branch name does not mean WorkOS is installed). See [the operating guide](firebase-authentication-setup.md) and [verification report](firebase-authentication-verification.md).

Use Firebase Authentication on Spark for email/password sign-up, sign-in, email verification, password reset, session refresh, and sign-out. Each verified Firebase user gets one private Cloudflare D1 workspace. Other users never see or publish to that workspace. Firebase is the identity provider, not the project database.

The user has selected isolated workspaces for all users. Each workspace is a server-authorized partition of the same D1 database; users do not create Cloudflare accounts/databases. The existing Cloud Sync checkpoint is `d16cc57884909235df273babba379844cc784db8`.

## Agreed boundaries

- Local SQLite remains authoritative. Local features work without sign-in or internet.
- Cloud data remains in Cloudflare D1. Do not create Firestore, Realtime Database, Storage, Firebase Functions, or a mobile app.
- Reuse the current project/tracker/agent exporters, transactional dirty scopes, immutable prepared chunks, revision lineage, tombstones, upload preview, coordinator, retries, pagination, and explicit restored-database recovery.
- Preserve the current metadata allowlists. Paths, file contents, environment values, Vault values/notes, and assets remain local.
- One active publishing desktop per workspace remains the first-phase rule. This is account isolation, not bidirectional or multi-publisher sync.
- Account passwords are unrelated to the Vault master password. Cloud sessions work while the Vault is locked.
- No billing account, Blaze upgrade, SMS, passwordless email-link sign-in, paid Identity Platform features, commit, push, merge, or application release in this implementation.

## Architecture and compatibility

### 1. Firebase identity through Rust

Keep HTTP in Rust and expose typed Tauri commands through an `authentication` feature. Reuse the existing async HTTP and safe error patterns. Use Firebase's documented REST APIs rather than importing a browser SDK that stores sessions in browser storage.

The desktop public configuration contains the Firebase project ID, Firebase client API key, and existing Worker URL. This configuration is not a service-account credential. Validate it and restrict the key to the required Firebase authentication APIs; do not allow unrelated billable APIs. No Firebase Admin key or service-account private key is needed in the app.

Provide bounded requests and readable invalid-credential, offline, configuration, rate-limit, verification-required, and expired-session states. Never propagate raw provider responses or log passwords/tokens. Do not retry password submission automatically. Clear password fields after successful submission or dismissal.

Keep refresh tokens in Windows Credential Manager and ID tokens in Rust memory. React receives only safe account/session state. Serialize refresh requests, rotate saved refresh tokens safely, and never delete a valid session merely because the network is temporarily unavailable. Sign-out clears credentials and cancels cloud work, but does not delete local data or the pending queue.

### 2. Server-owned workspace and device authorization

Extend the Worker with Firebase ID-token verification and account/workspace/device persistence through the next append-only D1 migration. Verify signatures, supported algorithms, key IDs, issuer, audience, subject, expiration, and relevant timestamps using trusted Google signing keys. Require verified email before allocating or accessing cloud metadata.

Use the Firebase UID, not an email address supplied by the client, as the ownership key. The server allocates workspace/device identifiers. Each account can provision only one personal workspace. Repeated provisioning is idempotent, including concurrent requests. Every existing snapshot/read/recovery operation resolves its workspace from verified authorization; caller-supplied workspace IDs are never sufficient authorization.

Register the publishing desktop and issue an unguessable device credential stored by the existing native credential adapter. A server-only random key derives idempotent registration receipts with HMAC-SHA-256; raw device credentials are not persisted in D1. Publishing requires both the valid account identity and the registered publishing device credential. A future read-only mobile device may read the same user's workspace, but mobile and second-publisher editing are not implemented here. Replacing the publishing desktop requires explicit confirmation and preserves the existing recovery rules.

Retain the current snapshot protocol and payload allowlists. Add account provisioning and device-registration contracts alongside the existing `/v1` snapshot and read APIs, rather than replacing the metadata pipeline. Scope rate limits by authenticated workspace/device and retain bounded request/query behavior.

### 3. Protect and adopt the existing private workspace

The deployed Phase 1 workspace already contains data. It must not be assigned to the first person who signs up.

Claiming it requires a verified Firebase session, possession of the existing publisher credential, and an explicit confirmation in the original desktop. The Worker compares the credential hash and assigns ownership atomically. A second UID cannot claim or access it. An idempotent retry by the same UID is safe.

Do not delete or rebuild its snapshots, identifiers, revision lineage, or metadata merely to add authentication. Keep the existing private-token mode working until the deliberate claim. After ownership is established, disable legacy publisher/reader access for that claimed workspace. Fresh accounts get empty, separate workspaces and never inherit the legacy configuration.

### 4. Connect identity to the current local coordinator

Use the next append-only desktop migration only for the account/workspace binding and device authorization state needed by Cloud Sync. Existing migration files are immutable; reuse pre-migration backups.

Extend the current coordinator's authorization boundary to obtain a fresh ID token and the device credential while keeping its preparation, retries, acknowledgements, and revision checks intact. Do not clear prepared uploads until the server acknowledges the corresponding revision.

Bind the local cloud configuration to its owner UID. Signing in to a different account must not silently publish this local database to that account. Switching the cloud association requires explicit review/confirmation and a fresh cloud stream where appropriate. Check account/session generations before sending or acknowledging uploads so stale requests cannot affect a newly selected account.

Default future-user flow: sign up/sign in, verify email, provision workspace/device, review the existing first-upload preview, then enable sync. Users no longer enter a Worker URL, workspace ID, publisher ID, or raw publisher token in the normal setup flow. The current installation receives the separate protected claim flow.

### 5. UI and public interfaces

Frontend behavior belongs to `src/features/authentication/`, exported through `index.ts`. Rust behavior belongs to `src-tauri/src/features/authentication/`. Keep composition in `src/app/` and use React Query for session/gateway state. Extend the existing Cloud Sync Settings section instead of introducing a second sync service.

Reuse the current blue accent, accessible forms/dialogs, focus handling, loading feedback, and safe error components. Show sign-up, sign-in, verify/resend, password reset, safe account identity, and sign-out. Keep local navigation available when signed out. Do not expose token copy controls or store tokens in localStorage, Zustand, React Query, SQLite, or general settings.

Example boundary (names finalized alongside tests):

```typescript
type AuthSession =
  | { state: 'signedOut' }
  | { state: 'signedIn'; userId: string; email: string; emailVerified: boolean };

interface AuthenticationGateway {
  getSession(): Promise<AuthSession>;
  signIn(input: { email: string; password: string }): Promise<AuthSession>;
  signOut(): Promise<void>;
}
```

All external inputs and Firebase/Worker responses are bounded and validated. Reuse the existing safe Tauri error mapping. Cross-feature consumers use public entry points rather than deep imports.

## Ordered implementation and checkpoints

1. Define auth/session and cloud ownership contracts; prove rejected/foreign identity cannot authorize a workspace.
2. Add Worker verification, append-only ownership schema, and isolated provisioning; test against real local D1.
3. Add registered-publisher authorization and protected legacy claim; prove the existing snapshot protocol still works unchanged.
4. Implement Rust email/password and native session persistence with mocked HTTP/credential adapters; prove errors and token rotation do not leak credentials.
5. Connect authenticated account/device context to the existing local queue/coordinator; prove offline durability and account-switch isolation.
6. Compose the Settings UI through typed gateways and add unit/browser flows.
7. Document Firebase API restrictions and deployment ordering. Test locally before applying remote migrations or changing the live Worker. Confirm the existing account's claim during the real acceptance test.

At each checkpoint, run focused tests first and stop if ownership or compatibility proof fails. Keep existing unrelated task-plan sections intact; the active task checklist is appended in `tasks/todo.md`.

## Verification commands

From `C:\Users\Paul\Projects\devventory`:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run test:unit -- src/features/authentication src/features/cloud-sync
npm run cloud:typecheck
npm run test:cloud
npm run test:e2e -- e2e/specs/cloud-sync.spec.ts e2e/specs/authentication.spec.ts
npm run build
```

The authentication files and journeys above are implemented. Full repository verification and user-entered production acceptance are tracked separately.

From `C:\Users\Paul\Projects\devventory\src-tauri`:

```powershell
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test authentication
cargo test cloud_sync
cargo test
cargo check
cargo audit
```

Focused test fixtures are synthetic. Real Firebase sign-up and verification require the user's own credentials entered into the app; never ask for their password in chat. Full repository gates follow implementation; no test bypass is introduced.

## Required acceptance proof

- Account A and B each see only their own cloud projects/tracker/quotas; foreign snapshot IDs, cursors, workspace IDs, device credentials, recovery requests, and malformed/expired/wrong-project/unverified tokens are rejected.
- Missing auth configuration fails closed without preventing local app startup.
- Sign-up, correct/wrong-password sign-in, reset, verification, session restart, single-flight refresh, invalid refresh, sign-out, and account-switch errors have usable UI states and no secret output.
- Provisioning/device-registration races are safe; second publisher registration cannot silently replace the first.
- Legacy data remains readable to its existing authorized desktop before claim; only its verified owner with the legacy publisher credential can claim it; legacy credentials stop working afterward.
- Offline edits and edits made during uploads remain queued and publish to the correct owner's workspace after reconnecting. Sign-out, restore, and account changes never silently copy metadata to another user.
- Secret values, paths, Vault data, passwords, refresh tokens, and device credentials never enter metadata snapshots, general settings, browser persistence, or logs.
- The real acceptance test proves sign-in and isolation on Firebase Spark with the existing Worker/D1. Mobile remains out of scope.

## Firebase console preparation

Use the actual Firebase **project ID**, not its display name or numeric project number. The user supplied `devventory` and a public client API key. A read-only public configuration request initially returned `CONFIGURATION_NOT_FOUND`; after Authentication was enabled, it returned HTTP 200. This is configuration reachability proof, not a sign-in or verified-user acceptance test.

Keep Spark selected, Email/Password enabled, and Email link (passwordless) disabled for this scope. Verification and reset emails still work independently of passwordless sign-in. Do not link a billing account or enable Identity Platform upgrades. App Hosting, Firestore, and Storage are not needed.

## Review gate and remaining inputs

The user approved account isolation, single-publisher registration, protected legacy adoption, and explicit local account-switch consent. Public configuration matches the registered Firebase project; no service-account JSON is requested. The updated Worker and ownership migration are deployed. The existing workspace is deliberately unclaimed until the user signs in, verifies email, and confirms adoption in the original desktop. No mobile or application release is part of this implementation.

## Official references

- [Firebase Spark and billing behavior](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Firebase Authentication REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Firebase ID-token verification requirements](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase API key restrictions](https://firebase.google.com/docs/projects/api-keys)
- [Authentication and email quotas](https://firebase.google.com/docs/auth/limits)
