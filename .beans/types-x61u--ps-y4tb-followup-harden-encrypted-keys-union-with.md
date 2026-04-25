---
# types-x61u
title: "ps-y4tb followup: harden encrypted-keys union with Exclude<> (journal-entry, note) + defensive distributive Pick (lifecycle-event)"
status: todo
type: task
priority: normal
created_at: 2026-04-25T23:18:43Z
updated_at: 2026-04-25T23:18:43Z
parent: ps-y4tb
---

## Background

PR #561 type-design review (2026-04-25) suggested two type-system hardening follow-ups in the canonical chain:

### A. \`Exclude<>\` derivation for "encrypt by default"

\`packages/types/src/entities/wiki-page.ts\` already uses:

\`\`\`typescript
export type WikiPageEncryptedFields = Exclude<
keyof WikiPage,
"id" | "systemId" | "archived" | keyof AuditMetadata

> ;
> \`\`\`

This encodes "encrypt every domain field except this allowlist" — adding a new domain field to \`WikiPage\` will silently land in \`encryptedData\` (which is the safer default).

Two more entities have the same shape (every domain field except id/systemId/audit/archived/restructured-plaintext is encrypted) and currently use literal unions:

- \`packages/types/src/entities/journal-entry.ts\` — encrypted: 6 keys; literal union duplicates \`JournalEntry\` keys
- \`packages/types/src/entities/note.ts\` — same shape, with \`author\` carved as restructured plaintext

Adding a new domain field like \`mood\` would silently land in plaintext today.

### B. Defensive distributive Pick on \`LifecycleEventEncryptedInput\`

\`packages/types/src/entities/lifecycle-event.ts:165\` declares:

\`\`\`typescript
export type LifecycleEventEncryptedInput = Pick<LifecycleEvent, "notes">;
\`\`\`

This works only because \`notes\` is on \`LifecycleEventBase\` (present on every variant). If a future variant overrides \`notes\` with a tighter type (e.g. \`NonEmptyString\`), the non-distributive \`Pick\` will produce an intersection rather than a union, breaking variants.

Make it defensively distributive:

\`\`\`typescript
export type LifecycleEventEncryptedInput = LifecycleEvent extends unknown
? Pick<LifecycleEvent, "notes">
: never;
\`\`\`

## In scope

### A.1. \`journal-entry.ts\`

Replace:
\`\`\`typescript
export type JournalEntryEncryptedFields = "title" | "body" | "moodScore" | "tags" | "linkedMemberIds" | "linkedGroupIds";
\`\`\`

with:
\`\`\`typescript
export type JournalEntryEncryptedFields = Exclude<
keyof JournalEntry,
"id" | "systemId" | "frontingSessionId" | "archived" | keyof AuditMetadata

> ;
> \`\`\`

Verify the resulting union matches the literal one (use a parity assertion).

### A.2. \`note.ts\`

Same pattern with the \`author\` key carved out as restructured plaintext.

### B. \`lifecycle-event.ts:165\`

Apply defensive distributive Pick.

### C. Add type-level guard

In \`packages/types/src/**tests**/encrypted-fields-policy.test.ts\` (new), assert the union derivation matches expectations using \`expectTypeOf\`. The goal is to catch a future contributor who renames a key in \`X\` and breaks the \`Exclude\` allowlist.

## Out of scope

- Other entities that intentionally use literal unions where only a subset is encrypted (e.g., \`fronting-session.ts\` keeps \`comment\` plaintext on the server). Those need targeted Pick/Omit, not Exclude.

## Acceptance

- [ ] \`journal-entry.ts\` and \`note.ts\` use \`Exclude<>\` derivation
- [ ] \`LifecycleEventEncryptedInput\` is defensively distributive
- [ ] Parity assertions confirm the new derivations match the previous literal unions
- [ ] \`pnpm types:check-sot\` clean
- [ ] \`pnpm test\` green

## Cross-references

- Parent: ps-y4tb
- Triggered by: PR #561 review (2026-04-25)
