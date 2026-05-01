# ADR-023 — packages/types as single source of truth for domain entity shapes

## Status

Accepted (refreshed 2026-04-29). This ADR refines the original Zod-type-alignment decision by extending it into a full single-source-of-truth convention covering Drizzle schema and generated OpenAPI types alongside Zod.

| Date       | Refresh                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-04-22 | Pilot decision (Option B), Class C/E taxonomy, archivable discriminated chain.                                                                                                                         |
| 2026-04-29 | ps-6phh closeout: plaintext canonical chain documented; G8/G9/G10/G13 added; G6 expanded to fleet; G7 expanded to plaintext fleet. Full G1–G13 gate inventory added; G12 explicitly N/A for plaintext. |

## Context

The 2026-04-20 comprehensive audit flagged "branded-type drift at API/DB boundaries" as a recurring pattern. Root cause: four plausible sources for the same domain shape — `packages/types`, Drizzle schema in `packages/db`, Zod schemas in `packages/validation`, and generated `api-types.ts` in `packages/api-client`. Each layer can drift independently.

Drizzle cannot be the source of truth: the server only sees metadata columns plus an opaque `encryptedData` blob. It has no knowledge of the encrypted field names or their types. The types package is the only layer that holds the full decrypted domain shape.

## Decision

Every encrypted domain entity publishes a six-link canonical chain from `packages/types`:

1. **`<Entity>`** — full decrypted domain shape. Branded IDs, `Date` objects, all decrypted fields. No DB-internal columns.
2. **`<Entity>EncryptedFields`** — keys-union of fields encrypted client-side. Either a literal union or `Exclude<keyof <Entity>, allowlist>` when the policy is "encrypt every field except an allowlist".
3. **`<Entity>EncryptedInput`** — `Pick<<Entity>, <Entity>EncryptedFields>`. The shape callers encrypt and submit to `encryptedData`. Use a defensively distributive form (`<Entity> extends unknown ? Pick<…> : never`) when `<Entity>` is a discriminated union.
4. **`<Entity>ServerMetadata`** — raw Drizzle row. Branded IDs, `Date`, `encryptedData: EncryptedBlob` (or `| null`), plus DB-internal columns (search_tsv, partition keys, computed columns) and `ServerInternal<…>`-marked server-fill-only fields.
5. **`<Entity>Result`** — `EncryptedWire<<Entity>ServerMetadata>`. Server JS-runtime response shape: `encryptedData` brand-tagged as `EncryptedBase64`, `ServerInternal<…>` fields stripped.
6. **`<Entity>Wire`** — `Serialize<<Entity>Result>`. JSON-serialized HTTP shape: brands strip to plain `string`, `UnixMillis` becomes `number`, `EncryptedBase64` collapses to `string`.

### Plaintext entity canonical chain

For entities without client-side encryption, the chain is:

    X → XServerMetadata → XWire = Serialize<XServerMetadata>

Where `XServerMetadata` is one of:

- `X` (identity case — junction tables, `sync-document`)
- `Archivable<X>` (archivable plaintext entities — `friend-code`, `notification-config`)
- `X` extended with server-only columns wrapped in `ServerInternal<T>` (`account`, `audit-log-entry`, `blob-metadata`, `import-job`, `webhook-config`, `key-grant`)

The `Serialize<>` mapped type strips `ServerInternal<T>`-marked fields automatically, so server-only state never reaches the wire. Plaintext entities therefore publish a three-link chain — `X` → `XServerMetadata` → `XWire` — and the wire derivation is mechanical (G10 enforces `XWire = Serialize<XServerMetadata>`). No `EncryptedWire<T>` step is needed because there is no encrypted blob.

The taxonomy of encrypted-data shapes covered by this ADR:

- **Class A** — canonical six-link chain (above). The encrypted blob is a key-subset of the entity (`<X>EncryptedInput = Pick<<X>, K>`).
- **Class C** — divergent encrypted payload. The encrypted blob carries an auxiliary type that is **not** a key-subset of the entity (e.g., `DeviceInfo` for `Session`). Detailed in the "Class C" subsection below.
- **Class E** — server-side T3 encryption. The payload is encrypted with a server-held key, not E2E. The canonical chain does **not** extend to it. Detailed in the "Class E" subsection below.

The `EncryptedWire<T>` helper (`packages/types/src/encrypted-wire.ts`) and `Serialize<T>` together produce links 5 and 6 mechanically; only the keys-union and the server metadata require hand-authoring per entity. Per-entity service `<X>Result` types are derivations: `type <X>Result = EncryptedWire<<X>ServerMetadata>`. Hand-rolled `<X>Result` interfaces are reserved for cases where the wire shape genuinely diverges from the metadata (denormalized server-internal fields that must not leak, polymorphic refs the wire widens to plain string, validated narrowings of `Record<string, unknown>` payloads, etc.); each retained hand-roll documents _why_ in a comment above the interface.

Downstream layers derive-or-assert-equal rather than redefine:

| Layer                                      | Relationship to `packages/types`                                                                     | Enforcement                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drizzle (`packages/db/src/schema/pg/*.ts`) | Columns match `<Entity>ServerMetadata`                                                               | Per-entity compile-time assertion: `InferSelectModel<typeof table>` ≡ `<Entity>ServerMetadata`                                                               |
| Zod (`packages/validation`)                | Request/response schemas match their domain counterparts                                             | `z.infer<typeof Schema>` ≡ domain type (hand-authored full-entity schemas are optional; input-body schemas match `CreateEntityBody`/`UpdateEntityBody` etc.) |
| Generated `api-types.ts`                   | OpenAPI-derived response types match `<Entity>Wire`                                                  | CI parity check in `scripts/reconcile-openapi.ts`: `components["schemas"]["Entity"]` ≡ `<Entity>Wire`                                                        |
| Branded IDs                                | Declared only in `packages/types/src/ids.ts` using the canonical `Brand<T, B>` helper (symbol-keyed) | `packages/validation` re-exports rather than re-defines the `brandedString` helper                                                                           |

### Brand shape canonicalization

Pluralscape's canonical brand is symbol-keyed: `type Brand<T, B> = T & { readonly [__brand]: B }` where `__brand` is a module-internal `unique symbol` in `packages/types/src/ids.ts`. Literal-keyed forms (`{ readonly __brand: "Name" }`) are drift and must be migrated to `Brand<T, B>`. The `__brand` symbol is module-internal (marked `@internal` in JSDoc) — consumers should not import it. Construction of branded IDs goes through `brandId()` and `assertBrandedTargetId()`.

Sibling module-internal symbols follow the same pattern: `__encBase64` (in `encryption-primitives.ts`) brands wire-form base64 ciphertext, and `__serverInternal` (in `server-internal.ts`) marks server-fill-only fields. Both are `@internal` and exported only so co-located type-level helpers (`UnbrandedEquivalence<T>` and the `Serialize<T>` / `EncryptedWire<T>` strip rules) can structurally match the marker.

### `ServerInternal<T>` convention

`ServerInternal<T>` (defined in `packages/types/src/server-internal.ts`) marks
fields on `*ServerMetadata` types that are server-fill-only and must not leak
onto the wire. `EncryptedWire<T>` strips all top-level `ServerInternal<…>`-
marked fields automatically, and `Serialize<T>` strips those same fields
recursively at every nesting level so OpenAPI ↔ wire parity assertions remain
coherent.

Reference case: `FrontingComment.sessionStartTime` is denormalized from the
parent fronting session for the partition-FK in the partitioned
`fronting_sessions` table (ADR-019). It is server-internal and must never
appear in client-visible JSON.

### `EncryptedBase64` brand

`EncryptedBase64` (defined in `packages/types/src/encryption-primitives.ts`)
is a phantom brand on `string` for ciphertext on the wire. `EncryptedWire<T>`
threads the brand through `encryptedData` so the type system distinguishes
wire-form ciphertext from arbitrary strings (e.g. IDs). The brand is
constructed exclusively at the encoder boundary (`encryptedBlobToBase64` /
`encryptedBlobToBase64OrNull` in `apps/api/src/lib/encrypted-blob.ts`).

The OpenAPI generator emits raw `string` for `encryptedData` fields. The
parity bridge is `UnbrandedEquivalence<T>` (in `type-assertions.ts`) plus
the documented one-way subtype relation `EncryptedBase64 extends string`,
asserted explicitly in `scripts/openapi-wire-parity.type-test.ts`. This
preserves the canonical "brands on domain, not wire" model from the core
ADR while letting the wire envelope keep the brand internally.

### Optional-vs-`| undefined` semantics

`packages/types` uses `?:` (key may be missing) for optional fields. Zod's `.optional()` infers `T | undefined` (key present, value undefined).

**Pilot decision (2026-04-22):** Option B — normalize `packages/types` input-body optional fields to `T | undefined`. The Member pilot (`packages/validation/src/__tests__/type-parity/member.type.test.ts`) surfaced **0 optional-vs-undefined mismatches** across `CreateMemberBody` / `UpdateMemberBody` / `DuplicateMemberBody`, because those bodies happen to contain only required fields. Zero is well below the `≥ 10` threshold at which a helper would pay off, so the fleet convention is: when a future input-body type introduces an optional field that pairs with a `.optional()` Zod schema, declare it as `readonly field: T | undefined` (not `readonly field?: T`) so `Equal<z.infer<...>, Body>` remains green. Full-entity types (`<Entity>`) keep `?:` optional markers — only input-body types on the API boundary convergence to Zod's inference shape. `Equal` remains the default parity helper; no `OptionalEqual` sibling is introduced.

### Transform consumer convention — `packages/data/src/transforms/`

Every per-entity client-side transform module owns **functions only**. Local
domain/wire/encrypted-input/raw-row aliases are forbidden — the transform
imports `<Entity>`, `<Entity>EncryptedInput`, `<Entity>Wire`, and `Archived<<Entity>>`
directly from `@pluralscape/types`. Runtime validation of decrypted blobs is
delegated to `<Entity>EncryptedInputSchema.parse(decrypted)` from
`@pluralscape/validation`; hand-rolled `assertX*` validators are removed.

When the API serializer omits fields the canonical wire requires (e.g. tRPC
`listVotes` does not surface `systemId`/`version`/`updatedAt` for `PollVote`),
the transform owns a narrow `<Entity>ServerWire = Omit<<Entity>Wire, …>` shim
local to the transform file — never an `as unknown as <Entity>Wire` cast.
This keeps the ServerWire deviation explicit at the boundary and visible to
reviewers.

The Member-pilot transform (`packages/data/src/transforms/member.ts`) is the
canonical reference shape for new transforms.

### Class C — divergent encrypted payload

Class A's six-link chain assumes `<X>EncryptedInput = Pick<<X>, K>`. For Class C, the encrypted blob carries an auxiliary type that is **not** a key-subset of the entity:

- The auxiliary type is published in `packages/types/src/entities/<entity>.ts` and used **directly** as the canonical "encrypted input" — no `<X>EncryptedInput` alias is introduced (aliases are forbidden under the pre-production policy).
- The Zod parity gate is named after the auxiliary type: `<AuxiliaryType>Schema` in `packages/validation/src/<entity>.ts`. The parity assertion in `packages/validation/src/__tests__/type-parity/<entity>.type.test.ts` is `Equal<z.infer<typeof <AuxiliaryType>Schema>, <AuxiliaryType>>`.
- The SoT manifest's `encryptedInput` slot points at the auxiliary type by name.
- `<X>Result` and `<X>Wire` follow this rule: if `<X>ServerMetadata` has no Class E sidecar columns, `<X>Wire = Serialize<<X>>` is sufficient (the encrypted blob is absent from the domain `<X>`). If it has a Class E sidecar (e.g., `ApiKey.encryptedKeyMaterial`), define `<X>ServerVisible = Pick<<X>ServerMetadata, ...>` as a positive allowlist excluding the sidecar, and use `<X>Wire = Serialize<<X>ServerVisible>`. The positive `Pick` allowlist is fail-closed — a future column added to `<X>ServerMetadata` defaults to excluded from the wire surface. Each wire type's JSDoc documents the chosen rationale.
- The naming convention for the projection is `<X>ServerVisible`. Currently used by `ApiKey` (the only Class C entity with a Class E sidecar today). `Session` and `SystemSnapshot` use `Serialize<<X>>` directly because their server metadata has no sidecar.

Class C entities (3): api-key, session, system-snapshot.

### Class E — server-side T3 encryption

Some encrypted payloads are encrypted with a **server-held key**, not E2E. The payload is `T3EncryptedBytes` (a phantom-branded `Uint8Array` from `packages/types/src/encryption-primitives.ts`), not `EncryptedBlob` (which carries the T1 envelope). Server-side encryption never crosses the wire to clients — clients see only the entity's plaintext metadata.

The canonical chain does **not** extend to Class E:

- `<X>Wire = Serialize<<X>>` — the server-only `encryptedData` (or `encryptedKeyMaterial`) `T3EncryptedBytes` is stripped by being absent from the domain type
- No `<X>EncryptedInput` is published — there is no client-supplied input shape
- No Zod parity for the encrypted payload — its shape is server-internal
- The `T3EncryptedBytes` brand is constructed at the encrypt boundary (e.g., `encryptWebhookPayload` in `apps/api/src/services/webhook-payload-encryption.ts`) or via the `toT3EncryptedBytes` helper (`apps/api/src/lib/encrypted-blob.ts`); Drizzle columns use `.$type<T3EncryptedBytes>()` to thread the brand through reads.

Class E surfaces (2):

- **Entity-level:** `webhook-delivery` (`WebhookDeliveryServerMetadata.encryptedData: T3EncryptedBytes`)
- **Column-level inside a Class C entity:** `ApiKeyServerMetadata.encryptedKeyMaterial: T3EncryptedBytes | null` (only present on `CryptoApiKey` rows). The `ApiKey` entity is therefore a hybrid Class C + Class E — its primary encrypted blob follows the Class C convention, while the side-channel key material is documented as a Class E exception.

### Archivable plaintext entities — discriminated `ServerMetadata`/`Wire`

For plaintext entities with the `archivable` column pair (`archived`,
`archived_at`), the database CHECK constraint
`(archived = true) = (archived_at IS NOT NULL)` is reflected in the type
system as a discriminated union:

- `<X>ServerMetadata = Archivable<<X>>` where
  `Archivable<T> = T | Archived<T>` (defined in
  `packages/types/src/utility.ts`)
- `<X>Wire = Serialize<<X>ServerMetadata>` — the discriminated form falls
  out automatically because `Serialize` distributes over unions
- The flat Drizzle row shape is reconstructed locally in the parity test
  (`packages/db/src/__tests__/type-parity/<x>.type.test.ts`) and not
  exported from `@pluralscape/types` — this prevents accidental misuse in
  application code

The runtime invariant is defended once at the Drizzle read boundary by
`narrowArchivableRow<T>` (`apps/api/src/lib/archivable-row.ts`). The
adapter throws on either inconsistent state — defensive against the CHECK
ever being dropped or violated.

Parity tests in `packages/db/src/__tests__/type-parity/` are the source of
truth for the applied set; future plaintext archivables emerging from
`ps-6phh` follow this pattern.

Encrypted archivables remain on the `EncryptedWire<T>` row-shape contract
(Class A/B/C) — the encrypted-keyset row dominates the parity story and
the discriminated archivable shape doesn't compose cleanly with it.

### Enforcement — `pnpm types:check-sot`

A single root script (`scripts/check-types-sot.ts`) runs all three parity mechanisms sequentially, short-circuiting on first failure. CI step in `.github/workflows/ci.yml` blocks on failure. Drift at any layer fails CI.

### Parity gate inventory

The full set of CI-enforced gates that defend the canonical chain:

| Gate | What it checks                                                              | Where                                                                            |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| G1   | Domain ↔ Drizzle row equality (encrypted)                                   | `packages/db/src/__tests__/type-parity/<entity>.type.test.ts`                    |
| G2   | Drizzle ↔ Zod input parity                                                  | `packages/validation/src/__tests__/type-parity/<entity>.type.test.ts`            |
| G3   | Domain ↔ Zod encrypted input                                                | `packages/validation/src/__tests__/type-parity/<entity>.type.test.ts`            |
| G4   | Body Zod ↔ Transform output                                                 | `packages/data/src/__tests__/type-parity/<entity>.type.test.ts`                  |
| G5   | Encrypted ServerMetadata ↔ Drizzle row                                      | `packages/db/src/__tests__/type-parity/<entity>.type.test.ts`                    |
| G6   | Manifest completeness (fleet bidirectional)                                 | `packages/db/src/__tests__/type-parity/__manifest-completeness__.type.test.ts`   |
| G7   | OpenAPI ↔ Wire equality                                                     | `scripts/openapi-wire-parity.type-test.ts`                                       |
| G8   | No hand-rolled `*Body`/`*Input`/`*Credentials`/`*Params`/`*Args` interfaces | `tooling/eslint-config/rules/no-hand-rolled-request-types.js`                    |
| G9   | No `params: unknown` + `safeParse` in services; no `parseAndValidateBlob`   | `tooling/eslint-config/rules/no-params-unknown.js`                               |
| G10  | Wire derivation = `Serialize<server>` or `Serialize<result>`                | `packages/types/src/__tests__/wire-derivation.type.test.ts`                      |
| G11  | Every tRPC procedure has REST counterpart (or in `REST_ONLY_SET`)           | `apps/api/scripts/check-trpc-parity.ts`                                          |
| G13  | Plaintext ServerMetadata ↔ Drizzle row                                      | `packages/db/src/__tests__/type-parity/plaintext-server-row-parity.type.test.ts` |

G12 is intentionally omitted — it does not apply to plaintext entities (it covered an encrypted-only invariant absorbed into G5).

Drift on any gate fails CI. The G8 and G9 rules have no allow-list mechanism — adding exceptions requires modifying the rule source itself, which is reviewed at the same level as a feature change. Project-wide `@eslint-community/eslint-comments/no-use` applies uniformly, so `eslint-disable` comments cannot bypass the rules in any subtree.

## Consequences

- Field additions/renames must start in `packages/types`, not in Drizzle or Zod.
- Encrypted-field schema decisions (`T1` encrypted vs `T3` plaintext per field) remain judgment calls, not mechanically derived.
- Full codegen from types → Drizzle/Zod is explicitly rejected (non-goal).

### M9a closeout state (2026-05-01)

- Encrypted-entity chain applied fleet-wide: every encrypted entity in `packages/types/src/entities/` publishes a `ServerMetadata` and an `EncryptedWire<…>`-derived `Result`, with `Wire = Serialize<Result>` (ps-y4tb). `EncryptedWire<T>` (`packages/types/src/encrypted-wire.ts`) is the canonical decrypt-boundary helper across the fleet (types-emid, ps-6lwp, types-cfp6).
- Plaintext SoT pass closed: all plaintext clusters consolidated under the `X → XServerMetadata → XWire = Serialize<XServerMetadata>` chain, including discriminated `Archivable<T>` for archivable plaintext entities (types-ltel, ps-6phh, types-0e9j). G13 in `plaintext-server-row-parity.type.test.ts` is the fleet-wide bidirectional gate.
- Brand fleet expansion landed for non-ID branded scalars: `Note.title`/`Note.content` (types-cdr5), `Poll.title`/`PollOption.label` (types-e6n9), `FieldDefinition.name` (types-gkhk), `FrontingSession.comment`/`positionality`/`outtrigger` (types-09m5), and lifecycle-event display brands (types-yxgc). Branded-ID drift cleanup across five surfaces tracked under ps-q8vs.
- `pnpm types:check-sot` runs G1–G11 + G13 sequentially in CI; drift on any gate fails the build.

## Cross-links

- ADR-006 — encryption boundary
- ADR-018 — encryption-at-rest boundary
