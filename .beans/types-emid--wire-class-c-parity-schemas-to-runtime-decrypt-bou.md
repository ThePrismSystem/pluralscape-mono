---
# types-emid
title: Wire Class C parity schemas to runtime decrypt boundaries
status: todo
type: task
created_at: 2026-04-27T14:30:14Z
updated_at: 2026-04-27T14:30:14Z
---

Three Zod parity schemas for Class C entities are currently parity-gates only — not yet wired to a runtime parse boundary. This bean tracks wiring them at the decrypt callsites once those callsites materialize.

## Schemas

- `ApiKeyEncryptedPayloadSchema` (`packages/validation/src/api-key.ts`)
- `DeviceInfoSchema` (`packages/validation/src/session.ts`)
- `SnapshotContentSchema` (`packages/validation/src/snapshot.ts`)

## Why deferred

The schemas exist as compile-time parity gates so type and Zod stay in sync. Runtime parsing requires a JSON-vs-binary adapter for `publicKey` (the in-memory schema rejects strings). Without a concrete decrypt callsite to wire to, runtime adoption was deferred from the original ADR-023 Class C extension PR (#578).

## Acceptance

- Schemas consumed at the actual decrypt callsites for ApiKey / Session / SystemSnapshot blobs
- JSON-vs-binary adapters in place (e.g., `EncryptedBase64Schema` for `publicKey` in ApiKeyEncryptedPayload)
- The "in-memory contract" comments in the validation modules removed once wired

## Related

- ps-qmyt (original Class C extension)
- ps-8e36 (PR #578 review fixes)
- types-8f84 (SnapshotContent server-shaped junction projections — adjacent cleanup)
