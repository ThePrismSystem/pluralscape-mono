---
# types-kk7a
title: "ps-y4tb followup: JSDoc + ADR cross-reference cleanup (system, friend-connection, member-photo, ADR-023)"
status: todo
type: task
priority: normal
created_at: 2026-04-25T23:18:05Z
updated_at: 2026-04-25T23:18:05Z
parent: ps-y4tb
---

## Background

PR #561 review (4-agent ultrareview, 2026-04-25) flagged JSDoc and cross-reference gaps in the canonical type chain rollout. They are non-blocking — the chain integrity is intact — but worth tightening so future readers can rely on the JSDoc as authoritative documentation.

## In scope

### A. JSDoc tightening (3 entities)

1. **`packages/types/src/entities/system.ts:53-59`** — `SystemServerMetadata` adds `archived: boolean` on the server row, but `System` (domain) has no `archived` field. Current JSDoc says "archivable metadata"; understates that this is a server-only field with no domain counterpart. Rewrite the divergence note to call this out explicitly.

2. **`packages/types/src/entities/friend-connection.ts:53-60`** — `FriendConnectionAuxOmitFields` JSDoc only documents reason #2 (junction table). The three-reasons enumeration lives on `FriendConnectionServerMetadata` JSDoc. Move the three-reasons block to the alias JSDoc (or cross-link), since the alias names reason #2 and a hover-reader needs to see all three reasons to understand it.

3. **`packages/types/src/entities/member-photo.ts:26`** — `MemberPhotoEncryptedFields` lists `sortOrder` as encrypted, but `MemberPhotoServerMetadata` re-adds it as plaintext for indexing and `CreateMemberPhotoBodySchema` accepts it top-level. Either drop `sortOrder` from `MemberPhotoEncryptedFields` (and document the divergence) or add a divergence note alongside `MemberPhotoEncryptedInput` explaining one listed field is plaintext server-side.

### B. ADR cross-reference fix (28 entity files)

Anchor-block comment `// ── Canonical chain (see ADR-023) ────` was added across 28 entity files in commit `678d2326`. The repo has `docs/adr/023-zod-type-alignment.md` but no `023-server-internal-and-encrypted-base64-conventions.md`. Either:

- Confirm `023-zod-type-alignment.md` is the right anchor and update no docs.
- Write the proper canonical-chain ADR and renumber/cross-link.

Decide and either fix the comments or write the ADR.

## Out of scope

- Class C entities (api-key, session, system-snapshot) — see ps-qmyt
- The structural drift catch on `LifecycleEventServerMetadata` — separate types-level test, not a JSDoc fix
- Branding suggestions (\`pinHash\`, \`Relationship.label\`) — separate bean (TBD)

## Acceptance

- [ ] `system.ts` JSDoc explicitly notes the domain has no \`archived\` field
- [ ] `friend-connection.ts` alias JSDoc captures all three orthogonal Omit reasons
- [ ] `member-photo.ts` resolves the \`sortOrder\` encrypted-vs-plaintext mismatch (either by removing it from \`MemberPhotoEncryptedFields\` or documenting the divergence)
- [ ] ADR-023 cross-reference is correct in all 28 entity files
- [ ] \`pnpm types:check-sot\` clean

## Cross-references

- Parent: ps-y4tb
- Triggered by: PR #561 review (2026-04-25)
