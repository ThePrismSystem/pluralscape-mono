---
# api-3xin
title: "Fix message router: DB ownership, dispatch simplification, targeted serialization"
status: completed
type: task
priority: normal
created_at: 2026-03-21T03:51:47Z
updated_at: 2026-03-21T04:02:35Z
parent: ps-irrf
---

Implements 3 audit findings (Sec-M1, S-M1, P-H4) from the M3 comprehensive audit.

## Summary of Changes

### Sec-M1: Persist document ownership to DB

- `checkAccess` now queries `sync_documents.system_id` on cache miss
- In-memory map remains as hot cache; DB is source of truth
- Fails open on DB errors (E2E encryption prevents data exposure)
- 5 new tests covering DB lookup, cache population, and error handling

### S-M1: Simplify dispatchWithAccess

- Removed the `dispatchWithAccess` generic helper function
- Inlined parse/access-check/dispatch/post-success logic into each switch case
- FetchSnapshotRequest, FetchChangesRequest, SubmitChangeRequest, SubmitSnapshotRequest
  now have self-contained, readable dispatch blocks

### P-H4: Replace recursive binary field transform

- Added `BINARY_FIELD_PATHS` constant mapping message types to their known binary field locations
- `serializeServerMessage` now walks only known paths instead of recursing the entire object
- Covers SnapshotResponse, ChangesResponse, DocumentUpdate, SubscribeResponse
- Messages without binary fields skip transformation entirely
- 7 new tests verifying targeted approach matches recursive behavior
