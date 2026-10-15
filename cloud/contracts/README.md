# Mobile read contract v1

The Worker owns this contract. `src/contracts.ts` remains the upload allowlist;
`src/read-contracts.ts` derives read schemas from it and adds receipt metadata and
the server-generated issue message. These schemas support documentation and
consumer checks; they do not change the deployed handlers or publisher protocol.

- [`read-v1.schema.json`](read-v1.schema.json): JSON Schema for workspace discovery,
  paginated reads, and errors. Its top-level union represents separate response
  shapes, not one response containing all of them.
- [`fixtures/read-v1.json`](fixtures/read-v1.json): synthetic workspace states and
  requests/responses covering all twelve published record kinds, pagination,
  empty results, and representative errors.
- [`fixtures/quota-status-v1.json`](fixtures/quota-status-v1.json): domain examples
  checked by the desktop's actual Rust status and timezone functions. Optional
  fixture inputs `resetReachedAt` and `usageIsStale` default to null and false;
  these defaults are fixture shorthand, not changes to the quota wire schema.
- [`../../docs/mobile-read-api-v1.md`](../../docs/mobile-read-api-v1.md): endpoints,
  consistency, errors, freshness, and quota semantics.

Run from the desktop repository:

```powershell
npm run cloud:contract:export
npm run cloud:contract:check
npm run cloud:typecheck
npm run test:cloud
cargo test --manifest-path src-tauri/Cargo.toml mobile_quota_contract_fixtures_match_desktop_domain --lib
```

The exporter uses [Zod's JSON Schema conversion](https://zod.dev/json-schema).
Do not hand-edit its output. The cloud tests verify generation drift, allowlist
compatibility, and the actual authenticated snapshot/read pipeline using disposable
local D1. Firebase signature verification has separate real-signature tests.

The mobile repository pins the two fixture files under `test/contracts/fixtures`.
When the contract changes, refresh those copies from this directory, run its Dart
decoding tests, and run `dart run tool/check_contract_sync.dart ../devventory`.
The mobile tests remain runnable without a sibling checkout. The decoding tests
are an interoperability baseline; feature DTO and repository tests are added with
their implementation phases.

Keep breaking wire changes versioned. Additive changes require coordinated schema,
fixture, and consumer updates; do not silently add private fields. Production
acceptance and deployment are recorded separately from synthetic contract tests.
