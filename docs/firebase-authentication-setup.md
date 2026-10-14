# Firebase accounts and private Cloud Sync

This phase adds email/password accounts without replacing local SQLite or the existing Cloudflare sync pipeline. All users share the deployed Worker and D1 service, but every verified Firebase UID owns a separate server-authorized workspace. Users do **not** create their own Cloudflare account, database, UUIDs, or publisher tokens.

Local projects, tracking, Agent Usage, files, assets, and Credential Vault remain available without sign-in. Cloud Sync is optional, disabled by default, desktop-to-cloud only, and metadata-only. Account passwords are separate from Vault master passwords. Mobile, teams, multiple publishing desktops, cloud values, and bidirectional editing are not implemented.

## Firebase console: administrator setup

Use project `devventory` on **Spark**, without linking billing or upgrading to Identity Platform. Authentication → Sign-in method must enable **Email/Password**. Disable **Email link (passwordless sign-in)** for this phase; ordinary verification and password-reset emails do not require it. Do not enable Firestore, Storage, Functions, or SMS.

The bundled `src-tauri/firebase-public.json` contains the public client API key, textual project ID, numeric project number, and Worker URL. This is not a service-account credential. No Admin private key belongs in the app or repository.

In Google Cloud → APIs & Services → Credentials, review the client key's **API restrictions**. This integration needs Identity Toolkit API (`identitytoolkit.googleapis.com`) and Token Service API (`securetoken.googleapis.com`). Do not allow unrelated billable APIs such as Gemini or Maps. Browser HTTP-referrer restrictions are not appropriate for native Rust requests; test API restrictions with sign-in and refresh before distribution. Review Authentication quotas and email templates. See [Firebase's API-key guidance](https://firebase.google.com/docs/projects/api-keys).

On Spark, the documented daily email allowances include 1,000 verification emails, 150 reset emails, and 5 passwordless sign-in-link emails. Limits can change; monitor the [current Authentication limits](https://firebase.google.com/docs/auth/limits). Quota/rate-limit errors keep local data intact and give a safe retry message.

## Deploy the authentication extension once

From `C:\Users\Paul\Projects\devventory`, with Node.js 24+ and the authenticated Wrangler installation:

```powershell
Set-Location 'C:\Users\Paul\Projects\devventory'
npm ci
npm run cloud:typecheck
npm run test:cloud
npm run cloud:auth:configure
npm run cloud:migrate:remote
npm run cloud:deploy
```

The order matters:

1. `cloud:auth:configure` checks Worker secret names. If the device-signing key already exists, it leaves it untouched. Otherwise it generates a random 256-bit key in ignored `cloud/auth-secrets.local.json` and sends it to Wrangler through stdin, without printing it. Do not rotate/delete this key: device receipt recovery relies on it. Securely back up the ignored file when generated.
2. Apply append-only D1 migration `0003_account_workspaces.sql`. It adds ownership/device tables; existing metadata snapshots are retained. Do not edit applied migrations or delete the database.
3. Deploy the Worker with `FIREBASE_PROJECT_ID=devventory`, the existing D1 binding, and existing legacy configuration. Secret updates can deploy a Worker version, so schema application still precedes deployment of the new auth code.

Existing `SYNC_PUBLISHER_TOKEN_HASH` and `SYNC_READER_TOKEN_HASH` remain unchanged. Do **not** rerun `cloud:setup`, replace `credentials.local.json`, rotate updater signing keys, or publish an application release for this setup.

Deployed endpoint: `https://devventory-sync.devventory.workers.dev`. D1: `devventory-sync`. The bundled desktop configuration selects that endpoint automatically; ordinary users never type it.

For local Worker development only:

```powershell
npm run cloud:auth:configure -- --local-only
npm run cloud:migrate:local
npm run cloud:dev
```

The helper appends missing local auth settings without replacing existing `.dev.vars`. Automated tests use disposable local D1 and synthetic signed tokens, not Firebase users or your application data. For manual account-based localhost testing, use a development build with a matching public configuration/Worker URL and synthetic local data. Production configuration remains HTTPS `*.workers.dev`; don't commit a localhost replacement.

## First-time user flow

1. Open the updated development app → Settings → Cloud Sync → **Create account** (or Sign in).
2. Enter the email/password privately in the app, not chat. Choose a password satisfying the Firebase project's policy; confirm it on signup.
3. Click **Send verification email**, open the message, complete verification, then return and click **I verified my email**. Cloud access requires verified email.
4. Click **Connect cloud workspace** and approve linking this computer's local database to the displayed account. The server allocates identifiers and registers this publishing desktop.
5. Click **Review and enable sync**. Review the metadata counts and approve the first upload separately. Linking alone does not upload data.
6. Wait for **Metadata is synced** with zero pending updates. Offline edits remain queued and publish after connectivity returns while the app is running.

### Reading sync feedback

- **Up to date** is muted and disabled after a successful sync with no queued changes. The status says **Metadata is synced** and shows the last successful sync time.
- **Nothing to sync** is disabled when there is no queued metadata but no successful upload yet. It does not claim an upload succeeded.
- **Sync now** becomes clickable when updates are pending and this account can publish. The Settings status refreshes every five seconds; automatic background synchronization still runs independently.
- **Syncing…** is disabled while an upload is running, preventing duplicate clicks.
- Offline, rejected credentials, recovery, and other errors remain visible even with an empty queue. If status refresh itself fails, **Status unavailable** replaces the sync action and **Retry status** refreshes it without sending metadata.

An empty queue does not trigger another upload just to test connectivity. The last successful time describes the last completed upload, not a new connection check. Pausing remains available; local edits continue to be saved.

**Forgot password?** sends Firebase password-reset instructions. The UI gives the same safe notice whether an account exists. This does not reset or recover your local Vault master password.

## Your existing private workspace: protected adoption

Use the original desktop/profile that already has the Phase 1 connection and its publisher credential in Windows Credential Manager. Before adopting it, keep a normal backup of your local database and Vault files. Do not clear/reset local data or create another Firebase workspace for this account first.

After signing in and verifying email, Settings offers **Connect existing cloud data**. Review the displayed account carefully and confirm. The original native publisher credential proves ownership; the first person who signs up cannot claim existing data. Existing cloud snapshots, workspace/device IDs, local revisions, prepared uploads, and queued edits are preserved.

Once claimed, old publisher/read-only tokens no longer authorize that workspace. Keep the ignored legacy credential file privately for historical backup, but it is not a new login token. Repeated/lost receipts are recoverable by the same owner/device. No production claim is performed by a deployment command.

If the old credential is unavailable, stop and investigate the original profile's native credential entry; don't rebuild cloud data or assign ownership without proof. If the Firebase account already owns a different workspace, adoption is deliberately rejected rather than merging private data.

## Sessions, account switching, and publisher replacement

Refresh tokens and device credentials are in Windows Credential Manager. ID tokens stay in Rust memory; React gets only email, UID, verification, and session state. Passwords are component-local during submission and are cleared after success or dismissal. Account operations use bounded Rust HTTPS requests and safe errors; tokens never belong in SQLite, browser storage, metadata, logs, or screenshots.

Restart restores the saved account profile and refreshes authorization when needed. Temporary network failures preserve it. Invalid/revoked refresh credentials require sign-in again. Rotation is persisted before further network lookup so interrupted requests do not strand the session.

**Sign out** cancels active sync, removes native account credentials, and pauses uploads without deleting local data or the queue. Even a cloud SQLite error must not prevent clearing account credentials. A credential-store failure is reported; resolve it rather than assuming the token was deleted.

**Switch account** changes identity, not the local database. It cannot silently publish existing projects to the new account. Explicitly review linking this computer to another account, then approve the separate first-upload preview. Previously linked cloud data stays separate; it is not downloaded, merged, or deleted. Local SQLite is a workstation database, not a per-user data container: anyone with access to that OS profile can still see its local metadata.

Only one desktop may publish per workspace. A different desktop must explicitly review **Make this the publishing desktop**, which revokes the prior publishing credential. Existing cloud data remains visible until any separate, deliberate recovery/rebuild. Never approve **rebuild cloud metadata** merely to dismiss an error: it replaces the visible cloud mirror from this computer. Restoring an older local database still triggers explicit recovery.

Worker signature/issuer/audience/time checks reject malformed, expired, wrong-project, and unverified tokens. This version does not call Firebase Admin revocation checks per request; a previously issued ID token can remain valid until its normal expiry after provider-side revocation. Desktop refresh detects invalid refresh credentials; publisher replacement revokes device writes immediately. See [Firebase session lifetime and revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).

## Private production acceptance

Run this only after the updated Worker is deployed and the native development app has restarted:

- Sign in/signup with your own credentials, complete verification, and adopt the existing workspace with original publisher proof.
- Review/enable upload. Confirm your projects, tracker, and quotas remain visible and status reaches synced.
- Disconnect internet, edit safe synthetic metadata, fully quit/reopen the app, then reconnect. Confirm queued edits upload automatically without duplicate records.
- Sign out: cloud publishing stops while local features and data remain usable. Sign back into the same owner and deliberately resume sync.
- With a separate test account on a separate OS/profile or isolated test database, verify its cloud workspace is empty/separate and cannot read the owner's data. Do not link your real local database to that account just to test isolation.
- Anonymous requests to `/v1/projects` must return HTTP 401; read identities cannot publish without the registered device credential.

Never send account passwords, ID/refresh/device tokens, ignored credential files, or secret hashes in chat. Report only statuses, safe error codes/messages, and counts. Synthetic local tests prove protocol isolation; they do not replace this real-user acceptance checkpoint.

## API extension and rollback boundary

`GET /v1/workspaces` returns the verified user's workspace/device identifiers (or null). `POST /v1/workspaces` provisions one workspace idempotently; caller-chosen IDs are rejected. `POST /v1/devices` registers/replaces a publisher with explicit replacement and expected-current-device checks. `POST /v1/workspaces/claim` requires the old publisher proof plus verified identity/confirmation. Existing snapshot/read/recovery endpoints keep protocol version 1 and derive workspace context from authorization.

Desktop migration 17 stores owner UID and non-secret registration IDs only. D1 migration 3 stores isolated workspace/device authorization metadata. Desktop migrations 1–16 and D1 migrations 1–2 are unchanged. Existing pre-migration backups apply. On problems, pause sync and preserve data; do not roll back applied migrations or deploy legacy-only code after an ownership claim, since it would remove the claim's protection.

See [the implementation plan](firebase-authentication-implementation-plan.md) and [ADR-0002](decisions/0002-firebase-identity-cloud-workspaces.md).
