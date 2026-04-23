---
# types-tef0
title: OpenAPI-Wire parity for Member and AuditLogEntry - resolve enc/dec boundary
status: todo
type: task
priority: normal
created_at: 2026-04-22T22:58:41Z
updated_at: 2026-04-22T23:56:42Z
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
