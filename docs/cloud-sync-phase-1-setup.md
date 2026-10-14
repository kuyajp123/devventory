# Cloud Sync Phase 1: setup and operating guide

For account-enabled builds, use the [Firebase account setup guide](firebase-authentication-setup.md). The private-token steps below document the original bootstrap; preserve existing credentials and use protected account adoption rather than generating a second workspace.

Devventory keeps its SQLite database and local behavior. Opt-in Cloud Sync publishes all projects, Environment Tracker metadata/results (including linked custom tracker entries), and current Agent Usage accounts/quotas to one private Cloudflare workspace. The desktop is the sole writer. Mobile and public account registration are later phases.

Cloud data is a metadata mirror, not a full Devventory backup. Local paths, scanned file contents, environment values, Vault notes/values, Stronghold files, assets, notification delivery records, and release credentials are excluded. Project descriptions, rule descriptions, project/source/key names, and agent account identifiers are included: avoid putting secrets into these metadata fields.

## Before starting

Run commands from `C:\Users\Paul\Projects\devventory`, with Node.js 24 or newer and dependencies installed. Use a free Cloudflare account. No paid domain or GitHub Actions deployment is required. Keep the Workers Free plan selected.

```powershell
Set-Location 'C:\Users\Paul\Projects\devventory'
npm ci
```

The implementation pins Wrangler and its local D1 runtime. `npm run test:cloud` uses disposable D1 databases and synthetic credentials; `cargo test cloud_sync --lib` includes a real Rust publisher → localhost HTTP → Worker → D1 test, without using your application database or cloud account. Local CI includes both Worker type checks and integration tests.

## Generate your private workspace credentials once

```powershell
npm run cloud:setup
```

This generates `cloud/credentials.local.json` and `cloud/.dev.vars`. Both are ignored by Git. Setup refuses to overwrite either existing file. It does not create or deploy cloud resources, and does not print raw tokens.

Open the credential file privately in your editor. Do not paste its contents into chat. Use these fields carefully:

| Field            | Where it belongs                                                                 |
| ---------------- | -------------------------------------------------------------------------------- |
| `workspaceId`    | Worker `vars.SYNC_WORKSPACE_ID` and the desktop Workspace ID field               |
| `deviceId`       | Worker `vars.SYNC_PUBLISHER_DEVICE_ID` and the desktop Publisher device ID field |
| `publisherToken` | Desktop Publisher token field; Windows Credential Manager stores it              |
| `publisherHash`  | Worker secret `SYNC_PUBLISHER_TOKEN_HASH`                                        |
| `readerToken`    | Reserved for private read API verification and future mobile pairing             |
| `readerHash`     | Worker secret `SYNC_READER_TOKEN_HASH`                                           |

The token and its hash are different values. Enter **only the raw `publisherToken` value** in Devventory, without JSON quotes or the field name. Do not paste the entire credential file. Enter the **hash** at the Wrangler secret prompt. Cloudflare login manages deployments; it is not the app credential. The Credential Vault master password is unrelated and is never sent to Cloudflare. The desktop token store works while Vault is locked. Native credential persistence in this phase targets Windows and fails closed on unsupported platforms.

To copy the publisher token privately without displaying it in the terminal:

```powershell
Set-Clipboard -Value ((Get-Content -Raw -LiteralPath 'C:\Users\Paul\Projects\devventory\cloud\credentials.local.json' | ConvertFrom-Json).publisherToken)
```

Paste into Devventory, then clear the clipboard with `Set-Clipboard -Value ''`. Never paste it into chat.

## Local D1 setup

```powershell
npm run cloud:migrate:local
npm run cloud:dev
```

Leave the second command running. Local migrations apply only to `cloud/.wrangler` development state. The `.dev.vars` file supplies local workspace/device IDs and token hashes, overriding configuration placeholders.

In a development build, use `http://127.0.0.1:8787` as the Worker URL, plus the generated IDs and publisher token. Packaged builds accept HTTPS `*.workers.dev` origins only. Use synthetic data for local manual testing; automated integration tests already isolate their data.

## Create the production D1 database

Create an account at <https://dash.cloudflare.com/sign-up>, verify your email, then authenticate Wrangler:

```powershell
npx.cmd wrangler login
npx.cmd wrangler d1 create devventory-sync --location apac --config cloud/wrangler.jsonc
```

If you already created the database in the dashboard, skip the create command. This workspace is configured for `devventory-sync` (`98a2797c-88ba-4840-8420-af5af3241f46`). For a different deployment, use its UUID as `database_id` under `d1_databases`. Keep the binding named `DB` and migrations directory `migrations`. Copy your generated workspace/device IDs into the corresponding `vars`. These UUIDs are not credentials and may be committed; raw tokens and hashes stay out of the tracked configuration.

The `apac` option is an Asia-Pacific location hint, not a guaranteed Philippine location. You may alternatively create `devventory-sync` through the dashboard's D1 SQL Database page and copy its UUID into this configuration.

Apply cloud migrations:

```powershell
npm run cloud:migrate:remote
```

These are separate from desktop migrations. Never import the full desktop SQLite file into D1.

## Store production hashes and deploy

```powershell
npx.cmd wrangler secret put SYNC_PUBLISHER_TOKEN_HASH --config cloud/wrangler.jsonc
npx.cmd wrangler secret put SYNC_READER_TOKEN_HASH --config cloud/wrangler.jsonc
npm run cloud:deploy
```

At the first prompt enter `publisherHash`; at the second enter `readerHash`. Wrangler may offer to create the named Worker if it does not exist; use `devventory-sync`. Secret updates can create/deploy Worker versions. Protected endpoints reject access until both secrets and the rate-limit binding are configured. The final deployment installs the application handler and its D1 binding.

Record the returned HTTPS `workers.dev` URL. Verify it without publishing application data:

```powershell
npm run cloud:verify -- https://devventory-sync.YOUR-SUBDOMAIN.workers.dev
```

Expected: missing credentials return 401, the publisher matches your workspace/device, the reader can read projects, and reader publication returns 403. This helper reads the ignored credentials file, keeps tokens out of arguments/logs, and prints no project contents. Zero projects is expected before the first desktop upload.

## Enable desktop synchronization

### This workspace's deployed connection

| Desktop field       | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Worker URL          | `https://devventory-sync.devventory.workers.dev`                                                         |
| Workspace ID        | `5e82c593-5cd0-4fd8-ba9d-e3318d228af6`                                                                   |
| Publisher device ID | `2d0e9e06-c60e-4ecc-a7d1-5ce4be53f444`                                                                   |
| Publisher token     | The `publisherToken` field in your ignored `cloud/credentials.local.json` file; never paste it into chat |

The D1 database UUID is **not** the Workspace ID. The publisher token is unrelated to your updater signing password and Credential Vault master password.

For acceptance before releasing a new installer, start the current source with `npm run tauri dev`. The existing installed release will not gain this Settings section until a later application release. The app applies migration 16 using its existing pre-migration backup mechanism; do not delete or replace your local database.

Open **Settings → Cloud Sync**. Enter the Worker URL, workspace ID, publisher device ID, and raw publisher token. Select **Save connection**. The token field clears after successful storage; leaving it blank preserves the saved credential only for the same Worker origin and workspace/device IDs. Changing the destination requires entering its token. Saving connection settings pauses synchronization.

Select **Review and enable sync**. Review the metadata counts and included identifiers, then select **Enable cloud sync**. All existing and subsequently created projects are included. Agent Usage is global and is included alongside project metadata.

The status reports pending scopes, successful publication time, offline retries, rejected credentials, or recovery. A pending update represents one project/tracker or one agent account/quotas, so multiple edits can be combined into one update. Pause retains the last cloud snapshot and all new local changes. Sync continues in the tray while Devventory is running; quitting resumes the durable queue next launch.

## Acceptance test

1. Enable sync and wait for **Metadata is synced**; verify online records through `cloud:verify` and the authenticated read API.
2. Disconnect the network. Edit a project/tracker or quota and confirm local changes are saved and remain pending.
3. Fully quit and reopen Devventory while offline; pending changes must remain.
4. Reconnect. Automatic sync must publish the changes and clear the queue.
5. Remove a test project/account or tracker entry and confirm the corresponding online projection disappears.
6. Verify missing/wrong credentials cannot read, and the reader cannot publish.

Run this against your deployed workspace after account setup. The automated local acceptance test covers the same persistence and reconnect path using synthetic data, and also checks duplicate matrix state and a rule-only absent key.

## Read API for future mobile

Every request uses `Authorization: Bearer <readerToken>` over HTTPS. The Worker derives the workspace from its trusted configuration and authenticated role; clients cannot select another workspace.

| Endpoint                                                                                            | Data                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `GET /v1/projects`                                                                                  | Project metadata                                  |
| `GET /v1/projects/{projectId}/tracker?kind=environment`                                             | Environments                                      |
| Same tracker endpoint, `kind=source`, `key`, `cell`, `occurrence`, `rule`, `issue`, or `validation` | Typed tracker records                             |
| `GET /v1/agent-accounts`                                                                            | Account/provider metadata                         |
| `GET /v1/agent-accounts/{accountId}/quotas`                                                         | Quota state, reset times and reminder preferences |

Responses contain `{ protocolVersion, items, nextCursor }`. Each item contains `{ kind, id, data, snapshotId, observedAt, receivedAt }`. Default page size is 50; `limit` accepts 1–100, and `cursor` is the previous `nextCursor`. For project tracker/account quota pagination, send the first page's `snapshotId` on subsequent requests to keep reading that complete snapshot while a new one publishes. List pages expose per-item snapshot IDs; they are not a workspace-wide point-in-time backup.

Tracker keys link to cells/occurrences through `keyId`; cells link to environments through `environmentId`. `kind=ruleTarget` returns bounded child records with `ruleId` and `environmentId`, avoiding oversized target arrays. Issues carry key/environment/rule metadata and safe server-generated messages. Source names are filenames or custom logical names, with no directory paths. The API provides stored tracking/quota facts rather than scanning files or inventing usage history. `observedAt` is snapshot creation time; source parse timestamps and validation `lastSuccessfulAt` report actual desktop checks. A future mobile client must show freshness and derive time-sensitive quota displays from reset times.

## Reliability and recovery

Desktop migration 16 creates metadata-only dirty-scope markers and prepared uploads. SQLite triggers run within the originating repository transaction, so rollback also rolls back queue changes. Repeated edits increment a scope revision and are coalesced. Secret/note-only Vault updates do not mark tracker scopes.

Snapshot builders read through one SQLite transaction and reuse the desktop matrix classification. Uploads are immutable, bounded to 25 records/64 KiB per chunk, with SHA-256 receipts. Manifests are bounded to 2 MB/20,000 chunks. Begin responses report the already received contiguous chunk prefix so rate-limit retries resume instead of restarting. Activation publishes the scope atomically; partial uploads remain invisible. An old acknowledgement cannot clear a newer revision. Tombstones hide deleted scopes and their children.

Local dirty markers are polled on a two-second coordinator tick, which waits for two seconds of scope inactivity before preparing an automatic upload. With pending work, actual API requests establish connectivity. Transient failures use jittered backoff from approximately five seconds to five minutes; rate limits respect `Retry-After`. Invalid credentials/payloads stop automatic retries and require corrective action. Requests have timeouts and reject redirects. No network request is needed for normal local saves.

Published previous snapshots remain available for 24 hours after their first replacement. Hourly bounded cleanup then retires expired/abandoned snapshots and deletes at most 200 records, 200 receipts and 20 empty snapshots per run. Cleanup backlogs can extend physical retention; this is not a permanent backup. Expired prepared uploads are replaced with a fresh snapshot/revision. Reader pagination should restart when a pinned snapshot returns 410. Pausing stops between bounded requests; an in-flight request may finish within its 20-second timeout.

If a restored desktop database has older cloud lineage or uses a different publisher stream, automatic publication stops with **Cloud metadata needs recovery**. Acknowledged/prepared snapshot IDs are checked as well as counters, so new offline edits cannot hide a restore. Keep a local backup, review which data should win, then use **Review cloud recovery** only if this desktop is authoritative. Type `rebuild cloud metadata` to confirm. This clears visible cloud heads, retires old rows for bounded cleanup, creates a fresh stream, and republishes local metadata; it does not restore cloud data into the desktop.

To revoke a token, generate a replacement privately, replace the corresponding Worker hash with `wrangler secret put`, and update that device's credential. Publisher and reader are independent roles. No account registration, password reset, mobile pairing UI, encrypted Vault synchronization, or multi-desktop conflict resolution is included.

## Free-tier limits and monitoring

The free plan currently allows 100,000 Worker requests/day, 5 million D1 rows read/day, 100,000 rows written/day, and 500 MB per D1 database (5 GB total/account). Each chunk stays below the 50-query free request limit. The Worker applies a per-role 60 requests/minute rate limit; these counters are local to Cloudflare locations, not a global billing cap. Large first uploads can pause and resume at this limit. Quota exhaustion retains local data and pending uploads.

Monitor requests, rows read/written and storage in Cloudflare's dashboard. Keep the free plan selected to avoid paid overage billing. Do not promise an uptime guarantee from a free tier. No Worker deployment runs in GitHub Actions; local CI tests do not access your production account.

References: [D1 setup](https://developers.cloudflare.com/d1/get-started/), [local development](https://developers.cloudflare.com/d1/best-practices/local-development/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
