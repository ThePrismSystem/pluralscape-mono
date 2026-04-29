---
# ps-toyo
title: "Address PR #586 review feedback — empty-string boundary, max-50 enforcement, JSDoc cleanup, brand-type assertions"
status: completed
type: task
priority: normal
created_at: 2026-04-29T08:41:51Z
updated_at: 2026-04-29T09:39:43Z
parent: ps-cd6x
---

Multi-agent review of PR #586 (M9a brand closeout) surfaced 4 important issues and 8 suggestions. This bean tracks the follow-up commits on the same branch:

- Commit 5: SP mapper empty-string boundary handling + per-schema empty-string-rejection tests (4 validation test files; 1 created)
- Commit 6: Encode 50-char limit on FrontingSession.comment via Zod refine + new MAX_FRONTING_COMMENT_LENGTH constant
- Commit 7: expectTypeOf brand assertions for Note/Poll/FieldDefinition
- Commit 8: JSDoc cleanup in value-types.ts + bean-body cleanup (drop local-audit references everywhere)

Out of scope per user direction: do not commit or reference the local audit doc anywhere; do not introduce a brandedStringAllowEmpty<B> helper now.

Plan: ~/.claude/plans/fix-all-of-the-typed-newell.md (local only)

## Summary of Changes

### Commit 5 (this commit)

Fixed runtime regression risk at the SP-import boundary for the brand-tightened
fields introduced by the four earlier brand-introduction commits.

- `packages/import-sp/src/mappers/fronting-session.mapper.ts` — coerce empty
  `sp.customStatus` to `null` for `FrontingSessionComment` (nullable target)
  using the cleaner `?.length` guard.
- `packages/import-sp/src/mappers/journal-entry.mapper.ts` — guard empty
  `sp.title` and `sp.note` and return `failed({ kind: "empty-name", ... })`
  with `targetField` set to `title` or `content`.
- `packages/import-sp/src/mappers/poll.mapper.ts` — guard empty `sp.name` and
  any option with empty `name` before the option-mapping `.map()`; both return
  `failed({ kind: "empty-name", ... })`.
- `packages/import-sp/src/mappers/field-definition.mapper.ts` — guard empty
  `sp.name` and return `failed({ kind: "empty-name", ... })`.

Added empty-string handling tests in each affected mapper test file plus
per-schema empty-string-rejection tests in:

- `packages/validation/src/__tests__/note.test.ts` (NoteEncryptedInputSchema)
- `packages/validation/src/__tests__/poll.test.ts` (PollEncryptedInputSchema,
  validates option label/id rejection through the parent schema since
  `PollOptionSchema` is module-private)
- `packages/validation/src/__tests__/fronting-session.test.ts`
  (FrontingSessionEncryptedInputSchema — accepts null and non-empty strings,
  rejects empty strings on each of comment, positionality, outtrigger)
- `packages/validation/src/__tests__/custom-fields.test.ts` (newly created;
  FieldDefinitionEncryptedInputSchema)

Used the existing `"empty-name"` `ImportFailureKind` literal across all the
required-non-empty boundaries — semantically the closest match and already
in use by the shared `requireName()` helper in
`packages/import-sp/src/mappers/helpers.ts`.

The pre-existing journal-entry test that asserted "allows empty body" was
inverted (no migration concerns: the codebase is pre-production with no
prod data). The local SP adversarial fixture's `note.emptytitle` entry was
removed from both the local-only export and manifest JSONs (gitignored
under `scripts/.sp-test-*.json`).

Verification: typecheck, lint, types:check-sot, unit (13194 passed),
integration (3063 passed), e2e (509 passed) all green; format:fix clean.

### Commit 6 (227e3d5b)

Encoded the 50-character limit on FrontingSession.comment via a Zod refine that preserves the FrontingSessionComment brand. Introduced MAX_FRONTING_COMMENT_LENGTH in new packages/types/src/fronting.constants.ts; the entity-level field declaration retains its existing constraint marker.

### Commit 7 (04524590)

Added expectTypeOf brand assertions for Note/Poll/FieldDefinition mirroring the FrontingSession precedent — locks in compile-time brand identity for the canonical chain projections.

### Commit 8 (this commit)

Removed all local-audit path references from packages/types/src/value-types.ts (6 sites) and from the 4 brand-task bean bodies (types-cdr5, types-09m5, types-e6n9, types-gkhk). Replaced audit-citing preambles with self-contained one-line rationale text. Aligned peer brand JSDoc (NoteContent, PollOptionLabel, FrontingSessionPositionality, FrontingSessionOuttrigger) to the existing LifecycleEventName one-line peer-delegation precedent. Fixed PollTitle grammar ambiguity. Named FieldDefinition's same-entity peer (description) explicitly. Verified zero local-audits references remain in packages/, .beans/, apps/.

Verification: format, lint, typecheck, types:check-sot, unit (13204 passed), integration (3063 passed), e2e (509 passed) all green.
