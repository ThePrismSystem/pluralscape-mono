---
# types-ltel
title: Types single source of truth
status: in-progress
type: epic
priority: normal
created_at: 2026-04-21T13:54:18Z
updated_at: 2026-04-22T23:05:34Z
parent: ps-cd6x
---

Make packages/types the single source of truth for all domain entity types; downstream layers (Drizzle, Zod, generated OpenAPI types) derive or assert-equal rather than redefine. Addresses the 2026-04-20 audit's recurring "Branded-type drift at API/DB boundaries" pattern, which is a symptom of having four plausible sources for the same shape.

Architecture: each entity gets two named types in packages/types:

- <Entity> — full decrypted shape (e.g. Member with all fields)
- <Entity>ServerMetadata — server-visible slice (IDs, plaintext scalars, encryptedData: Uint8Array)

Drizzle cannot be the source because the server only sees encrypted blobs plus metadata columns — it has no knowledge of the encrypted field names or their types.

## Enforcement

- Drizzle: per-entity integration test asserts InferSelectModel<typeof table> structurally equals <Entity>ServerMetadata
- Zod: per-entity type-level assertion that z.infer<typeof <Entity>Schema> equals <Entity>
- OpenAPI: CI parity check alongside existing reconcile-openapi.ts
- Branded IDs: defined only in packages/types/src/ids.ts; validation re-exports rather than re-defines
- Single CI gate: pnpm types:check-sot runs all three

## Children (see child task beans)

1. Refresh ADR-023 with types-as-SoT convention
2. Publish <Entity> + <Entity>ServerMetadata pairs in packages/types
3. Drizzle-to-types structural-equality integration tests
4. Zod-to-types z.infer equality assertions
5. CI job pnpm types:check-sot
6. Audit hand-rolled types across the codebase; route to @pluralscape/types

## Spec reference

docs/superpowers/specs/2026-04-21-m9a-closeout-hardening-design.md

## Phase 0 progress (2026-04-22)

Foundation landed: `Assert` / `Equal` / `Extends` / `Serialize` helpers (`packages/types/src/type-assertions.ts`), `SotEntityManifest` skeleton (`packages/types/src/__sot-manifest__.ts`), `pnpm types:check-sot` stub (`scripts/check-types-sot.ts`, runs `tsc --noEmit` on `@pluralscape/types`), ADR-023 refreshed. Also migrated `PendingAccountId` in `auth.ts` to the canonical symbol-keyed `Brand<T, B>` helper and marked `__brand` `@internal`. Proceeding to Phase 1 pilot (Member + AuditLogEntry).

## Phase 1 progress (2026-04-22)

Pilot landed. Member and AuditLogEntry through the parity stack:

- `MemberServerMetadata` / `AuditLogEntryServerMetadata` renamed from `Server<Entity>`
- `ClientMember` / `ClientAuditLogEntry` aliases removed; callers use `Member` / `AuditLogEntry` directly
- `MemberWire` / `AuditLogEntryWire` added as `Serialize<Entity>`
- Drizzle parity tests green for both entities (uses `StripBrands<T>` wrapper; brand-drift follow-up tracked as `db-drq1`)
- Zod parity tests green for Member input bodies; AuditLogEntry deferred (no server-generated input-body schemas exist). Option B decided (no `OptionalEqual` helper; fleet convention is `T | undefined` for optional input-body fields) — recorded in ADR-023.
- OpenAPI-Wire parity green on `EncryptedEntity` (which guards every T1 response including Member). Direct entity-wire parity deferred to `types-tef0` since OpenAPI exposes encrypted blobs not decrypted shapes.
- `pnpm types:check-sot` exits 0 on clean main, exits 1 when drift is introduced at any of the four layers (verified Task 18).
- Manifest completeness gate prevents silent entity drop-off (pilot-scope: Member + AuditLogEntry).

Fleet (Phase 2) next: ~23 remaining Server/Client entity pairs across 6 domain clusters. See follow-up plan for rollout. Follow-up beans: `db-drq1` (Drizzle helper branding), `types-tef0` (OpenAPI enc/dec boundary).
