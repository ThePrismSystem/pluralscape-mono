---
# types-ltel
title: Types single source of truth
status: completed
type: epic
priority: normal
created_at: 2026-04-21T13:54:18Z
updated_at: 2026-04-24T18:48:25Z
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

## Plan 2 fleet preconditions (documented by types-tef0)

Each per-entity fleet PR must include these substeps in addition to renaming the Server<X>:

**Types package** (`packages/types/src/entities/<x>.ts`):

1. Rename `Server<X>` → `<X>ServerMetadata`; move declaration from `encryption-primitives.ts` to the entity file.
2. Refactor as `<X>ServerMetadata = Omit<<X>, <X>EncryptedFields> & { encryptedData: EncryptedBlob }` (consumes the `<X>EncryptedFields` union already in place from types-tef0). Note Member also required omitting `"archived"` due to literal-type mismatch — check each entity for similar.
3. Add `<X>Wire = Serialize<<X>>`.
4. Delete old `Server<X>` / `Client<X>` declarations from `encryption-primitives.ts`.

**Drizzle schema conversion + parity** (`packages/db/src/schema/pg/<table>.ts` + `sqlite/<table>.ts` + `packages/db/src/__tests__/type-parity/<x>.type.test.ts`):

5. **Convert the entity's Drizzle table** (both PG + SQLite dialects) to use `brandedId<B>()` for ID columns. Wrap this entity's fixture + service ID/timestamp literals with `brandId<XId>()` / `toUnixMillis()` from `@pluralscape/types`.

```ts
// packages/db/src/schema/pg/<table>.ts
import type { <X>Id, SystemId } from "@pluralscape/types";
import { brandedId, pgEncryptedBlob } from "../../columns/pg.js";

export const <tableName> = pgTable("<table>", {
  id: brandedId<<X>Id>("id").primaryKey(),
  systemId: brandedId<SystemId>("system_id").notNull().references(() => systems.id, { onDelete: "cascade" }),
  // non-ID columns unchanged
  ...
});
```

Note: `db-drq1` landed only the `brandedId<B>()` helper + `AnyBrandedId` union — not the table conversions themselves. Each fleet PR converts its own table.

**Ordering**: convert `systems` (first fleet PR) and `accounts` (second) before leaf entities. They're FK ancestors of nearly every other table's fixtures, so leaf PRs can then rely on branded helpers without scope creep.

**Timestamp lift**: `pgTimestamp` / `sqliteTimestamp` customType generics are still `{ data: number }`. Your fleet PR can either (a) wrap the timestamp literals in its own fixtures with `toUnixMillis()` (matches `brandedId` pattern, sets up future lift), or (b) leave them as plain numbers. Fleet eventually flips the generics to `{ data: UnixMillis }` — last fleet PR to complete, or a dedicated cleanup PR.

6. Create a new parity test file asserting the Drizzle row shape structurally equals `<X>ServerMetadata`:

```ts
import { describe, expectTypeOf, it } from "vitest";
import { <tableName> } from "../../schema/pg/<table-file>.js";
import type { Equal, <X>ServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("<X> Drizzle parity", () => {
  it("row has the same property keys as <X>ServerMetadata", () => {
    type Row = InferSelectModel<typeof <tableName>>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof <X>ServerMetadata>();
  });

  it("row equals <X>ServerMetadata", () => {
    type Row = InferSelectModel<typeof <tableName>>;
    expectTypeOf<Equal<Row, <X>ServerMetadata>>().toEqualTypeOf<true>();
  });
});
```

After `db-drq1`, Drizzle column helpers return branded types directly — no `StripBrands<>` wrapper needed. Brand drift between Drizzle and domain is caught at compile time. The `StripBrands<T>` helper in `__helpers__.js` can be deleted once all fleet entities have converted and all parity tests are strict.

**Parity test** (`scripts/openapi-wire-parity.type-test.ts`): 6. Add split-form encrypted-wire parity for the entity:

```ts
type <X>ResponseOpenApi = components["schemas"]["<X>Response"];

expectTypeOf<
  Equal<
    Omit<<X>ResponseOpenApi, "encryptedData">,
    Omit<Serialize<<X>ServerMetadata>, "encryptedData">
  >
>().toEqualTypeOf<true>();

expectTypeOf<<X>ResponseOpenApi["encryptedData"]>().toEqualTypeOf<string>();
```

The Omit excludes the one structurally-impossible field (`encryptedData` is opaque `string` on wire but structured `EncryptedBlob` in domain). All plaintext columns (ids, timestamps, version, archived flags, and per-entity denormalized plaintext additions like `FrontingSessionResponse.structureEntityId`) are asserted.

**Data package** (`packages/data/src/transforms/<x>.ts`): 7. Rename hand-written `<X>EncryptedFields` interface → `<X>EncryptedInput = Pick<<X>, <X>EncryptedFields>` (consumes types-package keys-union). 8. Delete local `AssertXFieldsSubset` type (redundant — `Pick` enforces the constraint). 9. Delete hand-written `assertXEncryptedFields` runtime validator. 10. Update `encryptXInput(data: <X>EncryptedInput, masterKey)` signature.

**Validation package** (`packages/validation/src/<x>.ts`): 11. Add `<X>EncryptedInputSchema` Zod schema (every field of `<X>EncryptedInput`; nested types from shared `plaintext-shared.ts`). 12. Add Zod parity test: `Equal<z.infer<typeof <X>EncryptedInputSchema>, Pick<<X>, <X>EncryptedFields>>` (assert against `Pick` directly to avoid data → validation cycle). 13. Replace `assertXEncryptedFields` call sites (typically inside `decryptX`) with `<X>EncryptedInputSchema.parse()`.

**Consumer packages**: 14. `packages/import-sp/src/mappers/<x>.mapper.ts` + `packages/import-pk/src/mappers/<x>.mapper.ts`: rename imports `<X>EncryptedFields` → `<X>EncryptedInput`.

**Sot manifest** — already done by types-tef0 (all 20 entries include `encryptedFields`). Fleet only needs to upgrade the partial entries (`{ domain, encryptedFields }`) to full entries (`{ domain, server, wire, encryptedFields }`) as it lands `<X>ServerMetadata` and `<X>Wire`.

Pilot (Member) landed in types-tef0 as a reference implementation. The 18 non-pilot entities + Nomenclature are fleet scope.

## Fleet Progress

- [x] Cluster 1 — Foundation (Account, System, SystemSettings, SystemSnapshot, Nomenclature; PR #542, merged as 1a3e8d35)
- [x] Cluster 2 — Auth + devices (session, api-key, auth-key, device-token, recovery-key, account-purge-request, device-transfer-request; PR #545, merged as 3a4d4bca)
- [x] Cluster 3 — Members + identity (PR #550, merged as ead21c46)
- [x] Cluster 4 — Fields (PR #543, merged as 73da3ea8)
- [x] Cluster 5 — Structure graph (PR #549, merged as bf912ecd)
- [x] Cluster 6 — Fronting + lifecycle (PR #548, merged as 61729d50)
- [x] Cluster 7 — Innerworld (innerworld-region, innerworld-entity, innerworld-canvas; PR #544, merged as dcaa91cd)
- [x] Cluster 8 — Communication + engagement (PR #547, merged as e6261998)
- [x] Cluster 9 — Operational (PR #551, merged as 59ef63d5)
- [x] Cluster 10 — Privacy + social (PR #546, merged as b70c896c)
- [x] Cluster 11 — Cleanup (timestamp lift + StripBrands deletion; C11a #554, C11b #555, C11c feat/types-ltel-c11c-parity-closeout)

## Epic Closeout

All 11 clusters landed. Types package is the single source of truth for all server-owned entities. Drizzle rows structurally match `XxxServerMetadata` exactly — parity tests enforce via `Equal<Row, XxxServerMetadata>` with no StripBrands escape hatch. C11 surfaced and fixed 8 accumulated drifts (branded-ID columns, aligned actor union, narrowed locale/note-author types).

Follow-ups (separate beans):

- ps-6lwp — audit hand-rolled types across the codebase
- types-cfp6 — wire `pnpm types:check-sot` into `.github/workflows/ci.yml`
