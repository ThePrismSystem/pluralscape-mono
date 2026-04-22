---
# types-p2b0
title: Zod-to-types z.infer equality assertions
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T13:55:46Z
updated_at: 2026-04-22T23:06:07Z
parent: types-ltel
blocked_by:
  - types-f62m
---

Per-entity type-level assertion that z.infer<typeof <Entity>Schema> from packages/validation structurally equals <Entity> from packages/types. Catches drift between Zod validation schemas and the canonical domain type.

## Context

Pattern:

    type _MemberSchemaMatches = Assert<Equal<
      z.infer<typeof MemberSchema>,
      Member
    >>;

For entities where the Zod schema is naturally derivable via drizzle-zod for server-metadata shapes, use it; for the full <Entity> shape including decrypted fields, the Zod schema stays hand-authored but the equality assertion guarantees it matches the types package.

## Scope

- [ ] Add Assert / Equal type-level helpers in packages/validation/src/**tests**/helpers/type-assertions.ts (or reuse existing)
- [ ] For every entity published by the sibling types-pairs task, assert z.infer equals <Entity> for the full-shape schema
- [ ] Where drizzle-zod covers the server-metadata shape, add the generated schema + assert it equals <Entity>ServerMetadata
- [ ] Ensure the brandedString base helper re-exports from packages/types (carryover from the pairs task)

## Out of scope

- Drizzle parity (sibling task)
- OpenAPI parity (sibling task)

## Acceptance

- pnpm typecheck passes
- pnpm vitest run --project validation passes
- Changing a field type in packages/types causes pnpm typecheck to fail until the Zod schema is updated

## Blocked-by

types- bean "Publish <Entity> and <Entity>ServerMetadata pairs in packages/types"

## Phase 1 pilot progress (2026-04-22)

Pilot Zod parity delivered: `packages/validation/src/__tests__/type-parity/member.type.test.ts` asserts `z.infer<typeof CreateMemberBodySchema>` equals `CreateMemberBody` (and siblings). AuditLogEntry parity deferred with a `.todo` placeholder (audit logs are server-generated; no input-body schemas to assert against).

Option-B decision in ADR-023: fleet convention is to declare optional input-body fields as `T | undefined` (not `T?`). No `OptionalEqual` helper added since pilot encountered zero mismatches in Member input bodies.

Remaining (fleet, Phase 2): parity tests for the remaining entities' input bodies.
