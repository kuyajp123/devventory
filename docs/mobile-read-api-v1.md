# Devventory mobile read API v1

Status: documented against desktop base commit `0f1ef9d` and the current Worker
source. Protocol version remains 1. This document and the generated
[JSON Schema](../cloud/contracts/read-v1.schema.json) describe existing behavior;
they do not add endpoints or modify publishing.

## Identity and boundaries

Production origin: `https://devventory-sync.devventory.workers.dev`.
Send `Authorization: Bearer <Firebase ID token>` for the existing `devventory`
Firebase project. Email must be verified. Obtain and refresh the token through the
mobile Firebase SDK; do not reuse legacy reader tokens or desktop device tokens.
Never attach `X-Devventory-Device` from mobile. Worker authorization determines
the workspace from the token's UID; there is no caller-selected workspace query.

Mobile uses only the GET routes below. Workspace provisioning, protected adoption,
publisher registration/replacement, rebuild, and publication remain desktop work.
Firebase is the identity provider, while D1 holds the metadata mirror. No Firebase
application database is required.

## Endpoints

| Method and path                             | Successful response                       | Parameters                              |
| ------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| `GET /v1/workspaces`                        | `{protocolVersion: 1, workspaceId: string | null, deviceId: string                  | null}` | None |
| `GET /v1/projects`                          | Project record page                       | `limit`, `cursor`                       |
| `GET /v1/agent-accounts`                    | Agent account record page                 | `limit`, `cursor`                       |
| `GET /v1/projects/{projectId}/tracker`      | Tracker record page                       | `kind`, `limit`, `cursor`, `snapshotId` |
| `GET /v1/agent-accounts/{accountId}/quotas` | Quota record page                         | `limit`, `cursor`, `snapshotId`         |

Discovery returns null workspace/device IDs before desktop setup, or a workspace
with a null device before publisher registration. Mobile shows desktop-setup
guidance and does not create either resource. A registered publisher alone does
not establish that any metadata has been uploaded.

Tracker `kind` is one of `environment`, `source`, `key`, `cell`, `occurrence`,
`rule`, `ruleTarget`, `issue`, or `validation`; it defaults to `key`.
Path IDs use the current UUID routing format (lowercase hexadecimal and hyphens).
Record IDs are opaque strings: keys and relationship IDs are not necessarily UUIDs.

The record allowlist is inherited from `cloud/src/contracts.ts`. Its fields,
enums, bounds, and nullability are fully described in the generated schema.
Read issues additionally contain a safe `message` selected from `issueMessages`
by `issueType`; desktop's raw issue text is never part of the response.

## Pages and snapshot consistency

```json
{
  "protocolVersion": 1,
  "items": [
    {
      "kind": "project",
      "id": "44444444-4444-4444-8444-444444444444",
      "data": {},
      "snapshotId": "55555555-5555-4555-8555-555555555555",
      "observedAt": "2026-10-15T01:00:00Z",
      "receivedAt": "2026-10-15T01:01:00Z"
    }
  ],
  "nextCursor": null
}
```

`data` above is abbreviated; each real record must match its kind's schema.
`limit` defaults to 50 and must be an integer from 1 to 100. Records are ordered
by their opaque `id`; pass `nextCursor` unchanged as the next request's `cursor`
using proper URI query encoding. Stop only when `nextCursor` is null. The server
rejects cursors longer than 1024 characters. Empty results are a successful page
with `items: []` and `nextCursor: null`.

Root project/account lists combine the current heads of independent scopes. They
have no global snapshot token, and passing `snapshotId` to either list is invalid.
A list traversal is therefore not a point-in-time workspace snapshot; edits during
pagination may become visible on the next refresh. Do not claim workspace-wide
atomicity or manufacture a global snapshot ID.

For scoped detail reads:

1. Use the root project/account record's `snapshotId` as the detail anchor. This
   works even when the first requested child kind has no records.
2. Pass that ID on every child request and page. Pin every tracker kind to the
   same project snapshot; pin all quotas to the same account snapshot.
3. Stage all required pages/kinds. Replace a cached detail scope only after every
   required request succeeds and every returned record matches the anchor.
4. On HTTP 410, discard the staged attempt, refresh the root list to obtain a new
   anchor, and restart once. If expiry recurs, retain the previous complete cache
   and expose a retry state rather than looping indefinitely.

Superseded snapshots are retained for approximately 24 hours after replacement;
cleanup or a deliberate rebuild can invalidate a pin. The client must handle 410
regardless of age. An unknown unpinned scope currently returns an empty 200 page;
it does not reliably distinguish a deleted scope from a never-published one.
Do not erase cached data after a failed or incomplete root traversal. Remove
missing entries only after a successful complete authoritative refresh, and
invalidate their cached child scopes.

## Errors and retry

Errors use this envelope, without a `protocolVersion` field:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Cloud synchronization request could not be completed."
  }
}
```

| HTTP/code                                                       | Mobile behavior                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `401 UNAUTHORIZED`                                              | Refresh the Firebase token and retry once; require sign-in if still rejected.            |
| `403 EMAIL_VERIFICATION_REQUIRED`                               | Offer email verification and profile/token reload.                                       |
| `403 DEVICE_REQUIRED`                                           | Mobile must not send a device header or write request; surface a safe integration error. |
| `409 WORKSPACE_REQUIRED`                                        | Guide the user to finish desktop setup.                                                  |
| `410 SNAPSHOT_EXPIRED`                                          | Restart the pinned read as described above.                                              |
| `422 INVALID_INPUT`                                             | Treat as a contract/request defect; avoid automatic retry.                               |
| `429 RATE_LIMITED`                                              | Honor `Retry-After` (currently 60 seconds) and offer retry after the delay.              |
| `503 AUTH_UNAVAILABLE`, `STORAGE_UNAVAILABLE`, `NOT_CONFIGURED` | Retain complete cached data and allow bounded retry.                                     |
| Unknown code/status                                             | Show a safe generic failure and preserve cache; log only status/code.                    |

Responses include `Cache-Control: no-store`; an explicit private offline cache is
owned by the mobile application rather than an HTTP intermediary. Reads share a
60 requests/minute limiter per authenticated reader identity; workspace discovery
has a separate setup key. Load quota/project details on demand, bound concurrency,
and avoid polling every scope. Cancellation/account changes must prevent obsolete
requests from writing to another identity's cache.

## Freshness and offline semantics

- `observedAt`: the desktop's snapshot observation time.
- `receivedAt`: the cloud snapshot publication time, not the mobile download time.
- `fetchedAt`: a mobile-only local cache timestamp, never a Worker field.
- `usageUpdatedAt` / `usageIsStale`: quota observation metadata, independent of
  network freshness or successful mobile refresh.

A refresh can succeed while the desktop's observation remains old. Display those
facts separately. The cloud mirror advances only when desktop publishes. Cache
only successfully fetched complete scopes, namespace by Firebase UID/workspace,
and clear cached records on sign-out or identity/workspace changes. Never cache
credentials. Unfetched details remain unavailable offline rather than appearing
as an empty data set. Unsupported protocol versions must not replace a valid cache.

## Canonical agent usage semantics

The Rust agent domain is authoritative; [shared examples](../cloud/contracts/fixtures/quota-status-v1.json)
are executed against it. No derived availability field is sent over the read API.

Quota status precedence:

1. `resetReachedAt == resetAt`, or `resetAt <= now`: `available`.
2. Remaining percentage at or below 0: `exhausted`.
3. Remaining percentage at or below 20: `limited`.
4. Reset is at most 24 hours away: `resetSoon` (including unknown percentage).
5. Known remaining percentage: `available`; otherwise `unknown`.

Account precedence is `exhausted`, `limited`, `unknown`, `resetSoon`, `available`;
no quotas gives `unknown`. `usageIsStale` is displayed separately and does not
override this ordering. An elapsed reset means the desktop's availability policy
allows use; it does not establish a newly measured 100% remaining value.

The next reset is the earliest future reset without a matching `resetReachedAt`.
Reset timing is `elapsed` at/before now; otherwise compare calendar dates in the
quota's IANA timezone to label `today`, `tomorrow`, or `future`. Respect daylight
saving transitions; a fixed UTC offset is not a substitute for an IANA zone.

## Verification and rollout

See [contract maintenance](../cloud/contracts/README.md) for generation and tests.
Fixtures contain synthetic metadata only. They prove the source-level contract,
not deployment of that source or real-user acceptance. The mobile integration
gate still requires fresh authenticated publication, offline desktop restart/
reconnect, and isolated second-account acceptance on the intended desktop build.
