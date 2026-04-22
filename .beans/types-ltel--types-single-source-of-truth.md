---
# types-ltel
title: Types single source of truth
status: in-progress
type: epic
priority: normal
created_at: 2026-04-21T13:54:18Z
updated_at: 2026-04-22T22:12:31Z
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
