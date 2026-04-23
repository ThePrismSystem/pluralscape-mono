---
# types-tef0
title: OpenAPI-Wire parity for Member and AuditLogEntry - resolve enc/dec boundary
status: completed
type: task
priority: normal
created_at: 2026-04-22T22:58:41Z
updated_at: 2026-04-23T07:03:10Z
parent: types-ltel
---

## Context

Task 17 of the types-ltel pilot added `scripts/openapi-wire-parity.type-test.ts` and wired
it into `pnpm types:check-sot`. During that work, two fundamental mismatches between
`components["schemas"]["<Entity>"]` and the corresponding `<Entity>Wire` were discovered
and deferred.

## Member — encrypted-on-wire vs decrypted-in-domain

- `MemberResponse` in `docs/openapi.yaml` is `allOf: [EncryptedEntity]` — the server
  only ever emits the encrypted blob (`id`, `systemId`, `encryptedData`, `version`,
  `createdAt`, `updatedAt`).
- Domain `Member` in `packages/types/src/identity.ts` is the decrypted client-side
  representation (`name`, `pronouns`, `description`, `colors`, `saturationLevel`,
  `tags`, etc.).
- `MemberWire = Serialize<Member>` is therefore the _client-side post-decryption_
  JSON shape, not what crosses HTTP. These two live at different layers.

## AuditLogEntry — divergent shapes

OpenAPI schema fields vs domain type fields:

- `timestamp` (OpenAPI) vs `createdAt` (domain)
- `resourceType`/`resourceId` (OpenAPI) — no domain equivalent; domain embeds the
  resource pointer inside `eventType` or `detail`.
- `actor: string | null` (OpenAPI) vs `actor: AuditActor` (tagged union in domain).
- OpenAPI missing `systemId` and `detail` which domain requires.

## Options to consider

1. Introduce a distinct `MemberEncryptedWire` type equal to `EncryptedEntity` and
   assert parity against that; keep `MemberWire = Serialize<Member>` as the
   post-decryption shape and add a separate wire parity for it against whichever
   schema the plaintext spec publishes.
2. Align `AuditLogEntry` domain and OpenAPI — pick one canonical shape. The domain
   tagged-union `AuditActor` is richer; OpenAPI probably should describe the wire
   shape as `{ actorKind, actorId }` rather than a flattened `actor: string`.
3. Update the parity file to consume the new types once this is resolved.

## Acceptance criteria

- `components["schemas"]["MemberResponse"]` has a first-class parity assertion.
- `components["schemas"]["AuditLogEntry"]` equals `AuditLogEntryWire` (either by
  fixing the OpenAPI spec or by introducing a domain-level `AuditLogEntryWire`
  that matches the spec).
- Deferrals in `scripts/openapi-wire-parity.type-test.ts` are replaced with real
  `Equal<...>` checks.

## Decision (2026-04-22): Option 2 chosen

Publish the plaintext contract as a first-class OpenAPI surface, gated by CI parity.

### Why Option 2

- Catches a drift class Options 1 and 3 miss: the encryption contract itself (server encrypts {a,b,c} while client expects {a,b,d} would silently break without this).
- Symmetric with the epic's types-as-SoT philosophy — every layer a client interacts with has a declared contract.
- Enables integrator/SDK ecosystem work (AGPL, open-source, anti-gatekeeping stated values).

### Key existing-state finding

`docs/openapi/schemas/plaintext.yaml` already publishes 24 `Plaintext<Entity>` schemas and the openapi-typescript codegen produces `components["schemas"]["PlaintextMember"]` etc. The infrastructure is 100% in place — Option 2 becomes 'wire a parity assertion between PlaintextX and the domain Entity (minus server-only fields)' rather than 'invent a new convention.'

### Parity-assertion shape

Per-entity `<Entity>EncryptedFields` union identifies which fields get encrypted; parity assertion is:

```ts
Assert<
  Equal<components["schemas"]["PlaintextMember"], Serialize<Pick<Member, MemberEncryptedFields>>>
>;
```

Explicit, catches 'field added to Member but not encrypted' as a compile error.

### Prerequisite

Blocked-by `types-reorg` (per-entity file consolidation). Once every entity has its own file, `<Entity>EncryptedFields` has a natural home alongside `<Entity>`, `<Entity>ServerMetadata`, `<Entity>Wire`.

## Summary of Changes

### Universal — all 20 encrypted schemas

- Added `<Entity>EncryptedFields` keys-union for 19 entities + Nomenclature.
- Added 20 `PlaintextX` parity assertions in `scripts/openapi-wire-parity.type-test.ts`: `Equal<components['schemas']['PlaintextX'], Serialize<Pick<X, XEncryptedFields>>>`.
- Extended `SotEntityManifest` with `encryptedFields` slot per entry (partial form for non-pilot entities: `{ domain, encryptedFields }`).
- Reconciled `docs/openapi/schemas/plaintext.yaml` against domain drift — many entities needed `required:` lists updated, field names corrected (e.g., `notes` aligned, `coPresence` → `co-presence` in Nomenclature), InnerworldEntity rewritten as `oneOf` discriminated union.

### AuditLogEntry

- Rewrote OpenAPI schema to match domain: rename `timestamp` → `createdAt`, drop `resourceType`/`resourceId`, add `systemId`/`detail`, replace `actor: string` with `oneOf` matching `AuditActor` tagged union.
- Added domain/OpenAPI parity assertion: `Equal<components['schemas']['AuditLogEntry'], Serialize<AuditLogEntry>>`.
- Consumer sweep across apps/api + test fixtures.
- Extended `Serialize<T>` to strip `Plaintext<T>` branding; exported `__plaintext` symbol.

### Member pilot full-stack refactor

- `MemberServerMetadata = Omit<Member, MemberEncryptedFields | 'archived'> & { archived: boolean; archivedAt: UnixMillis | null; encryptedData: EncryptedBlob }` (derived, not declared). Additional `'archived'` omit needed because domain has literal `archived: false`.
- Added split-form encrypted-wire parity for Member: `Equal<Omit<MemberResponse, 'encryptedData'>, Omit<Serialize<MemberServerMetadata>, 'encryptedData'>>` + `MemberResponse['encryptedData']` is opaque `string`. Per-entity plaintext-column drift (including per-entity denormalized plaintext fields) is now caught. Fleet step #5 rewritten to this pattern.
- Data package: renamed hand-written `MemberEncryptedFields` interface → `MemberEncryptedInput = Pick<Member, MemberEncryptedFields>`. Deleted `AssertMemberFieldsSubset`.
- Validation package: added `MemberEncryptedInputSchema` Zod schema + parity test. New `plaintext-shared.ts` with `PlaintextImageSourceSchema` / `PlaintextSaturationLevelSchema` / `PlaintextTagSchema` / `HexColorSchema`.
- Replaced hand-written `assertMemberEncryptedFields` runtime validator with `MemberEncryptedInputSchema.parse()`.
- Closed enum-drift hole: `KNOWN_TAGS` + `KNOWN_SATURATION_LEVELS` exported as `as const` tuples from types; Zod schemas derive via `z.enum(TUPLE)`.
- `@pluralscape/validation` added as runtime dep of `@pluralscape/data` (for .parse() at decrypt time).
- Consumer updates: `packages/import-sp/src/mappers/member.mapper.ts` + `packages/import-pk/src/mappers/member.mapper.ts`.

### Quality gates

- `pnpm types:check-sot` — all 4 phases green (types typecheck, Drizzle parity, Zod parity, OpenAPI-Wire parity).
- `pnpm turbo typecheck` — green (21 packages).
- Negative-test fixture `scripts/openapi-wire-parity.negative-test.ts` proves the parity helpers are live.

### Plan 2 fleet preconditions

- 13-step checklist appended to `types-ltel` parent bean. Each fleet per-entity PR must follow.
- Fleet step #5 now mandates split-form per-entity plaintext-column parity (`Omit<..., "encryptedData">` equality + `encryptedData extends string`). The `encryptedData` field itself is the only structurally-impossible piece; all plaintext columns are fully asserted per-entity.

### Follow-up fix

Noticed during review that the Plan 2 fleet checklist on `types-ltel` was missing the `db` package Drizzle parity step. Added as step 5 of the checklist — fleet now creates a per-entity Drizzle parity test file (`packages/db/src/__tests__/type-parity/<x>.type.test.ts`) asserting `Equal<StripBrands<InferSelectModel<typeof <table>>>, StripBrands<<X>ServerMetadata>>`.
