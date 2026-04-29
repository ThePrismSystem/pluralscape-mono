---
# api-bqu4
title: Wire decryptDeviceInfo at session-list endpoint
status: completed
type: task
priority: normal
created_at: 2026-04-27T18:59:53Z
updated_at: 2026-04-29T00:01:28Z
parent: ps-cd6x
---

Wire the existing client transform `decryptDeviceInfo` (`packages/data/src/transforms/session.ts`) once the session-list API endpoint plumbs encryptedData through to clients.

## Background

Landed in `types-emid` (PR #579) as part of pre-release data-layer scaffolding. The transform is fully tested at the data-layer round-trip level but has no consumer today — `apps/api/src/services/auth/sessions.ts:listSessions` currently returns only `{id, createdAt, lastActive, expiresAt}`, no `encryptedData` field.

## Acceptance

- `apps/api/src/services/auth/sessions.ts` returns `encryptedData` on the session-list endpoint (or, if the design calls for it, on a sibling `get` endpoint).
- Mobile session-list view calls `decryptDeviceInfo(encryptedData, masterKey)` to surface platform / appVersion / deviceName.
- Wire shape registered in OpenAPI / tRPC contract.

## Related

- types-emid (PR #579 — schema and transform landed)
- ps-cd6x (Milestone 9a)

## Summary of Changes

- Extended SessionInfo with encryptedData field (apps/api/src/services/auth/sessions.ts)
- Added encryptedData column to listSessions SELECT projection with base64 conversion
- Updated OpenAPI schema source in docs/openapi/schemas/auth.yaml; rebundled
- Added withDecryptedDeviceInfo helper + SessionListRow types in @pluralscape/data
- Exported decryptDeviceInfo from data package index
- Added integration test verifying encryptedData round-trips on listSessions
- Added unit test for withDecryptedDeviceInfo (present + null cases)
- Added E2E contract test asserting encryptedData field is exposed on session list
- pnpm trpc:parity and pnpm types:check-sot pass

## Summary of Changes

Shipped in PR #583 (commit 1dd16910, merged 2026-04-28):

- `apps/api/src/services/auth/sessions.ts:28,59,73` — `listSessions` now projects `encryptedData` via `encryptedBlobToBase64OrNull`.
- `packages/data/src/transforms/session-helpers.ts` — new `withDecryptedDeviceInfo(session, masterKey)` helper using the `decryptDeviceInfo` codec from `transforms/session.ts`.
- OpenAPI / tRPC contracts emit the field; integration + E2E tests cover the round-trip.
- Mobile UI consumption is gated on the future session-list screen — not in scope here.
