---
# types-vmk9
title: "ps-y4tb followup: brand pinHash + tighten Relationship.label invariant"
status: todo
type: task
priority: normal
created_at: 2026-04-25T23:18:23Z
updated_at: 2026-04-25T23:18:23Z
parent: ps-y4tb
---

## Background

PR #561 type-design review (2026-04-25) flagged two stringly-typed escapes that carry runtime invariants the type system doesn't express:

1. **\`SystemSettings.pinHash: string | null\`** — this is a hashed app-lock PIN. Should be a brand (\`PinHash\`) so an unhashed PIN can't be assigned by mistake.

2. **\`Relationship.label: string | null\`** — only meaningful when \`type === "custom"\`. The current interface lets you set \`label\` on every \`type\`, including non-custom ones (where the label is silently ignored). A discriminated \`Relationship\` union (custom variant carries \`label: string\`, others omit) would express the invariant in the type system instead of leaving it to runtime checks.

## In scope

### A. Brand \`PinHash\`

In \`packages/types/src/entities/system-settings.ts\`:

\`\`\`typescript
export type PinHash = Brand<string, "PinHash">;
\`\`\`

Update \`SystemSettingsServerMetadata.pinHash\` to use the brand. Migrate the one or two call sites that hash the PIN to brand the result with \`brandId<PinHash>(hashed)\` (or \`brand<PinHash>\` for a non-id brand).

### B. Discriminate \`Relationship.label\`

In \`packages/types/src/entities/relationship.ts\`, replace:

\`\`\`typescript
export interface Relationship extends AuditMetadata {
readonly type: RelationshipType;
readonly label: string | null;
// ...
}
\`\`\`

with a discriminated union:

\`\`\`typescript
export type Relationship = AuditMetadata & ({
readonly type: "custom";
readonly label: string;
// ...
} | {
readonly type: Exclude<RelationshipType, "custom">;
// no label
// ...
});
\`\`\`

Migrate consumers (data transforms, validation schemas, openapi parity types) to handle the union.

## Out of scope

- Other free-text fields documented as "user-supplied display label" (e.g., \`fronting-session.comment\`, \`note.title\`) — those are intentionally free-text per ADR-023 and acceptable.
- \`note.authorEntityId: AnyBrandedId\` — already JSDoc-documented as polymorphic; the discriminator carries the brand. Leave as-is.

## Acceptance

- [ ] \`PinHash\` brand defined and applied to \`SystemSettingsServerMetadata.pinHash\`
- [ ] PIN-hashing call sites brand the result
- [ ] \`Relationship\` is a discriminated union with \`label\` only on the custom variant
- [ ] Validation schemas (\`packages/validation/src/...\`) reflect the discriminated shape
- [ ] OpenAPI parity remains green
- [ ] \`pnpm types:check-sot\` clean
- [ ] \`pnpm test\` green

## Cross-references

- Parent: ps-y4tb
- Triggered by: PR #561 review (2026-04-25)
