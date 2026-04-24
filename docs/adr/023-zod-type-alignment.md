# ADR-023 — packages/types as single source of truth for domain entity shapes

## Status

Accepted (refreshed 2026-04-22). This ADR refines the original Zod-type-alignment decision by extending it into a full single-source-of-truth convention covering Drizzle schema and generated OpenAPI types alongside Zod.

## Context

The 2026-04-20 comprehensive audit flagged "branded-type drift at API/DB boundaries" as a recurring pattern. Root cause: four plausible sources for the same domain shape — `packages/types`, Drizzle schema in `packages/db`, Zod schemas in `packages/validation`, and generated `api-types.ts` in `packages/api-client`. Each layer can drift independently.

Drizzle cannot be the source of truth: the server only sees metadata columns plus an opaque `encryptedData` blob. It has no knowledge of the encrypted field names or their types. The types package is the only layer that holds the full decrypted domain shape.

## Decision

Every domain entity publishes three named types from `packages/types`:

- **`<Entity>`** — full decrypted domain shape. Branded IDs, `Date` objects, all decrypted fields. No DB-internal columns.
- **`<Entity>ServerMetadata`** — raw Drizzle row. Branded IDs, `Date`, `encryptedData: Uint8Array` for encrypted entities, plus DB-internal columns (search_tsv, partition keys, computed columns) where applicable.
- **`<Entity>Wire`** — JSON-serialized view. Almost always `type <Entity>Wire = Serialize<Entity>`; hand-authored only when the `Serialize<T>` transform can't express the shape.

A fourth helper, **`EncryptedWire<T>`** (`packages/types/src/encrypted-wire.ts`), publishes the wire envelope produced by base64-encoding `encryptedData` for transport: `Omit<T, "encryptedData"> & { readonly encryptedData: string | (string | null) }`, with nullability preserved from `T`. The earlier "envelope is API-layer only" stance (kept locally inside `scripts/openapi-wire-parity.type-test.ts`) is reversed — when 30+ effective re-declarations of the same transform accumulate across the services tree, the SoT argument flips. Per-entity service `<X>Result` types are now derivations: `type <X>Result = EncryptedWire<<X>ServerMetadata>`. Hand-rolled `<X>Result` interfaces are reserved for cases where the wire shape genuinely diverges from the metadata (denormalized server-internal fields that must not leak, polymorphic refs the wire widens to plain string, validated narrowings of `Record<string, unknown>` payloads, etc.); each retained hand-roll documents _why_ in a comment above the interface.

Downstream layers derive-or-assert-equal rather than redefine:

| Layer                                      | Relationship to `packages/types`                                                                     | Enforcement                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drizzle (`packages/db/src/schema/pg/*.ts`) | Columns match `<Entity>ServerMetadata`                                                               | Per-entity compile-time assertion: `InferSelectModel<typeof table>` ≡ `<Entity>ServerMetadata`                                                               |
| Zod (`packages/validation`)                | Request/response schemas match their domain counterparts                                             | `z.infer<typeof Schema>` ≡ domain type (hand-authored full-entity schemas are optional; input-body schemas match `CreateEntityBody`/`UpdateEntityBody` etc.) |
| Generated `api-types.ts`                   | OpenAPI-derived response types match `<Entity>Wire`                                                  | CI parity check in `scripts/reconcile-openapi.ts`: `components["schemas"]["Entity"]` ≡ `<Entity>Wire`                                                        |
| Branded IDs                                | Declared only in `packages/types/src/ids.ts` using the canonical `Brand<T, B>` helper (symbol-keyed) | `packages/validation` re-exports rather than re-defines the `brandedString` helper                                                                           |

### Brand shape canonicalization

Pluralscape's canonical brand is symbol-keyed: `type Brand<T, B> = T & { readonly [__brand]: B }` where `__brand` is a module-internal `unique symbol` in `packages/types/src/ids.ts`. Literal-keyed forms (`{ readonly __brand: "Name" }`) are drift and must be migrated to `Brand<T, B>`. The `__brand` symbol is module-internal (marked `@internal` in JSDoc) — consumers should not import it. Construction of branded IDs goes through `brandId()` and `assertBrandedTargetId()`.

### Optional-vs-`| undefined` semantics

`packages/types` uses `?:` (key may be missing) for optional fields. Zod's `.optional()` infers `T | undefined` (key present, value undefined).

**Pilot decision (2026-04-22):** Option B — normalize `packages/types` input-body optional fields to `T | undefined`. The Member pilot (`packages/validation/src/__tests__/type-parity/member.type.test.ts`) surfaced **0 optional-vs-undefined mismatches** across `CreateMemberBody` / `UpdateMemberBody` / `DuplicateMemberBody`, because those bodies happen to contain only required fields. Zero is well below the `≥ 10` threshold at which a helper would pay off, so the fleet convention is: when a future input-body type introduces an optional field that pairs with a `.optional()` Zod schema, declare it as `readonly field: T | undefined` (not `readonly field?: T`) so `Equal<z.infer<...>, Body>` remains green. Full-entity types (`<Entity>`) keep `?:` optional markers — only input-body types on the API boundary convergence to Zod's inference shape. `Equal` remains the default parity helper; no `OptionalEqual` sibling is introduced.

### Enforcement — `pnpm types:check-sot`

A single root script (`scripts/check-types-sot.ts`) runs all three parity mechanisms sequentially, short-circuiting on first failure. CI step in `.github/workflows/ci.yml` blocks on failure. Drift at any layer fails CI.

## Consequences

- Field additions/renames must start in `packages/types`, not in Drizzle or Zod.
- Encrypted-field schema decisions (`T1` encrypted vs `T3` plaintext per field) remain judgment calls, not mechanically derived.
- Full codegen from types → Drizzle/Zod is explicitly rejected (non-goal).

## Cross-links

- ADR-006 — encryption boundary
- ADR-018 — encryption-at-rest boundary
