---
# types-yxgc
title: Branded value types for non-ID free-text labels (member form / display name)
status: in-progress
type: task
priority: high
created_at: 2026-04-25T20:28:59Z
updated_at: 2026-04-27T04:54:14Z
parent: ps-y4tb
---

## Background

Discovered during PR #561 (ps-y4tb fleet rollout) review. The type-design reviewer flagged `previousForm` / `newForm` on `FormChangeEvent` and `previousName` / `newName` on `NameChangeEvent` (both in `packages/types/src/entities/lifecycle-event.ts`) as `string | null` fields where cross-field assignment can't be prevented at the type level. After reading the file, these are not identifier references — they are free-text user-supplied display labels (e.g. "child age 8", "human male", "Alex").

The same pattern exists elsewhere in the domain (e.g. member display names, pronouns, group names — anywhere we accept user-supplied display text). Today every such field is a bare `string` (or `string | null`).

A branded string type would prevent accidental cross-field assignment (e.g. assigning a member name into a form-label field) without imposing a runtime cost.

## Proposed scope

Define branded value types in `packages/types/src/value-types.ts` (or extend `ids.ts`):

```typescript
export type MemberFormLabel = Brand<string, "MemberFormLabel">;
export type MemberDisplayName = Brand<string, "MemberDisplayName">;
// … other domain-meaningful display strings as discovered
```

Audit affected entities:

- `lifecycle-event.ts` — `previousForm`, `newForm`, `previousName`, `newName`
- `member.ts` — `name`, `pronouns`, `description` (verify each)
- Any other entity with display text fields

Update callers (services, transforms, tests) to brand values via the existing `brandValue<T>(raw)` helper (or define one if missing — `brandId<T>` only handles ID strings).

`Serialize<T>` already strips brands at the wire boundary (the `__brand` symbol case in `type-assertions.ts`), so wire types are unaffected.

## Out of scope

- Encrypted free-text fields (e.g. notes inside `encryptedData`) — branded value types apply to the post-decrypt domain shape, not to the opaque blob.
- Stringly-typed identifiers — those use `Brand<string, "XId">` via `brandId<T>` already.

## Design questions to resolve before implementation

1. Is `value-types.ts` the right home? Or per-entity additions to existing entity files?
2. Should branding be applied retroactively to all string fields, or only where cross-field assignment risk is concrete?
3. How does this interact with `ps-q8vs` (branded-ID drift cleanup)? Different concern (value vs ID), but similar mechanism.
4. Does the Zod `z.string().brand<T>()` pattern align with the domain definitions, or do we use plain `z.string()` and brand at the data-package transform layer?

## Acceptance

- [ ] Branded value types defined for in-scope display fields
- [ ] Domain entity types updated to use branded types
- [ ] All callers/transforms/tests updated to brand at construction
- [ ] `pnpm types:check-sot` clean
- [ ] CI green

## Cross-references

- Parent: `ps-y4tb` (Encrypted-entity SoT consolidation)
- Related: `ps-q8vs` (Branded-ID drift cleanup) — similar phantom-brand mechanism
- Triggered by: PR #561 review feedback (type-design-analyzer)

## Note on cross-reference cleanup

The lifecycle-event JSDoc on `previousForm`/`newForm`/`previousName`/`newName` references this bean by ID. When this bean is completed, those JSDoc cross-references must be removed (the fields will then carry branded types, making the comment obsolete). Track as part of this bean's acceptance.

## Follow-up beans opened

- types-f3fk — Brand fleet expansion (Member, Group, Channel)
- types-t3tn — Free-text label audit (custom-front, custom-field, member-photo)
