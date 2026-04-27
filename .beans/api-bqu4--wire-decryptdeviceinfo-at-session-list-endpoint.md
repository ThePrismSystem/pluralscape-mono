---
# api-bqu4
title: Wire decryptDeviceInfo at session-list endpoint
status: todo
type: task
created_at: 2026-04-27T18:59:53Z
updated_at: 2026-04-27T18:59:53Z
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
