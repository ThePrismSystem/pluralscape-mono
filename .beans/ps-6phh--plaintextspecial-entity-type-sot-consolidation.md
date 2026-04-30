---
# ps-6phh
title: Plaintext/special entity type SoT consolidation
status: completed
type: epic
priority: normal
created_at: 2026-04-25T08:02:48Z
updated_at: 2026-04-30T03:39:54Z
parent: ps-cd6x
blocked_by:
  - ps-y4tb
---

Consolidate the type chain for plaintext and special entities — sibling to ps-y4tb (which covers encrypted entities). Tackled after the encrypted-entity work proves the pattern.

## Scope: PLAINTEXT/SPECIAL ENTITIES (23 entities)

Per the 2026-04-25 audit:

- Plaintext with standard ServerMetadata (19 entities): account, account-purge-request, audit-log-entry, auth-key, blob, bucket-key-rotation, bucket-rotation-item, device-token, device-transfer-request, export-request, field-definition-scope, friend-code, friend-notification-preference, import-job, key-grant, notification-config, recovery-key, sync-document, webhook-config
- Plaintext junction tables with EncryptedFields = never (3 entities): structure-entity-association, structure-entity-link, structure-entity-member-link
- Request-only batch operation type (1 entity): import-entity-ref

## Differences from the encrypted bean

- No XEncryptedFields keys-union to lift (some have it set to never)
- No data-package transform (no encryption to apply)
- No XEncryptedInput type
- No XResult / EncryptedWire wrapping (XServerMetadata IS the wire shape)
- Some entities have hand-rolled request input types in @pluralscape/types (LoginCredentials, RegistrationInitiateInput, etc.) that need case-by-case judgment about whether to keep, redefine via z.infer, or drop

## Goals

- Drop redundant \*Body interfaces in @pluralscape/types where they duplicate z.infer<XBodySchema>
- Drop hand-rolled XRaw types in packages/data where applicable (some plaintext entities don't have transforms)
- Service signature cleanup: drop params: unknown, accept z.infer<XBodySchema>
- Add Zod-to-types parity tests for any hand-rolled request input types
- Audit and document handling for request-only types (import-entity-ref) and aggregated/computed result types

## Spec

To be written after ps-y4tb (encrypted entities) lands and the consolidation pattern is proven.

## Summary of Changes

Single PR (~31 commits) closing out the types-as-SoT consolidation work that has been declared complete three prior times (types-ltel, ps-y4tb, api-6l1q) without actually finishing.

**Service signature fleet cleanup (Tasks 5-15, C5-C11):**
Converted services from `params: unknown` + double-validation to
`body: z.infer<typeof XBodySchema>` + boundary-only validation.
`parseAndValidateBlob` helper retired (Task 22).

**Plaintext type chain (Tasks 17-21):**

- `ServerInternal<T>` rebrand on Account, AuditLogEntry, BlobMetadata,
  ImportJob, WebhookConfig, KeyGrant, SyncDocument
- Canonicalized `XWire = Serialize<XServerMetadata>` for 7 entities
- Added ExportRequest + ImportEntityRef canonical chains + manifest entries
- Dropped LoginCredentials, RegistrationInitiateInput,
  RegistrationCommitInput; consumers switched to `z.infer`

**New gates (Tasks 2, 3, 26, 27):**

- G8: no hand-rolled request types in @pluralscape/types/entities
- G9: no `params: unknown` in services; no `parseAndValidateBlob` imports
- G10: wire derivation parity (`XWire = Serialize<XServerMetadata|XResult>`)
- G13: plaintext ServerMetadata to Drizzle row equality

**Fleet expansions (Tasks 24, 25):**

- G6 manifest completeness: bidirectional, fleet-wide
- G7 OpenAPI parity: extended to plaintext entities with route schemas

**G11 verified (Task 28):** `pnpm trpc:parity` passes with full coverage; report saved.

**Regression trap (Task 23):** ALLOW_LIST arrays in lint rules asserted
literally empty by CI test. Adding entries to bypass fails the build.

**Test cleanup:** Removed 6 schema-level integration tests that bypassed
the route boundary (now covered by schema tests in
`packages/validation/src/__tests__/`).

## Completion proof

Zero-violation grep checks (all return 0):

- `params: unknown` in services: 0
- `parseAndValidateBlob` in services: 0
- `parseAndValidateBlob` in lib: 0
- Hand-rolled auth types (`LoginCredentials|RegistrationInitiateInput|RegistrationCommitInput`): 0
- `no-params-unknown` disable comments: 0

Gate runs (all green):

- `pnpm types:check-sot` -> pass (G6 fleet, G7 fleet, G10, G13)
- `pnpm lint` -> pass (G8 + G9 strict, allow-lists empty)
- `pnpm trpc:parity` -> pass (G11; 317 REST routes, 326 tRPC procedures, 316 checked)
- `pnpm typecheck` -> pass
- `pnpm test:unit` -> pass (1034 files, 13123 tests + 3 skipped)
- `pnpm test:integration` -> pass (153 files, 3036 tests + 22 skipped + 1 file skipped)

After merge: drift recurrence requires bypassing CI. The types-as-SoT
initiative is closed.
