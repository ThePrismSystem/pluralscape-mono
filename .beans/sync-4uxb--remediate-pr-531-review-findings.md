---
# sync-4uxb
title: "Remediate PR #531 review findings"
status: completed
type: task
priority: normal
created_at: 2026-04-21T02:48:35Z
updated_at: 2026-04-21T03:19:51Z
---

Multi-model review of PR #531 (chore/audit-m9-sync) surfaced 13 findings. Address error classification ambiguity, type narrowing, dirty-type plumbing, missing tests, and comment/bean hygiene.

## Task list

- [x] A. Error types & classification (DocumentTypeMismatchError, aeadDecryptOrClassify helper, delete verifyKeyBinding)
- [x] B. Sync engine error paths (applyLocalChange, getTypedSession, wrapSession generic, handleError on eviction)
- [x] C. Dirty-type plumbing through validator (computeDirtyEntityTypes, thread through runPostMergeValidation)
- [x] D. Type narrowing (dirtyEntityTypes: ReadonlySet<SyncedEntityType>, drop & Record<string, unknown>)
- [x] E. diffEntities dedupe invariant doc
- [x] F. Comment cleanup (strip bean suffixes, replace "legacy behaviour", remove narration)
- [x] G. Bean hygiene (api-c43q, api-l6w0, create sync-xjfi)
- [x] H. Missing tests (tombstone x empty dirty, diffEntities golden, wrong-type error path)
- [x] I. Public API barrel (remove verifyKeyBinding, add new errors)
- [x] Verification (lint, typecheck, sync unit, sync integration, /verify)

## Summary of Changes

Remediated all 13 findings from the multi-model PR #531 review:

**Error classification & public API**

- Added `DocumentTypeMismatchError` and `EncryptionKeyMismatchError` typed errors.
- Introduced `aeadDecryptOrClassify` helper; every AEAD failure in `decryptChange` / `decryptSnapshot` is now classified as `KeyBindingMismatchError` (attack) while the helper leaves a door open for `EncryptionKeyMismatchError` (benign key rotation) when the caller does not vouch for signature match.
- Removed unused `verifyKeyBinding` (no production caller, bindings already enforced by `decryptChange` / `decryptSnapshot`).

**Sync engine error paths**

- `applyLocalChange` now throws `DocumentTypeMismatchError` (not `NoActiveSessionError`) when the caller supplies the wrong type for a hydrated doc; redundant `parseDocumentId` comparison removed.
- `getTypedSession` now distinguishes not-hydrated (returns `undefined`) from wrong-type (throws `DocumentTypeMismatchError`).
- `wrapSession` made generic — no casts at the call site.
- Session-eviction early-returns during queued ops now surface via `handleError` instead of failing silently.

**Dirty-type plumbing (engine end-to-end)**

- Added `SyncEngine.computeDirtyEntityTypes(pre, post)` that derives the dirty set from shallow Automerge root-field reference inequality.
- Threaded through `applyIncomingChanges`, `hydrateDocument`, and `runPostMergeValidation` to `enforceTombstones`. The sync-2yh3 / sync-f4ma optimisations now trigger at runtime (validator path).
- Added exported `getEntityTypeByFieldName(fieldName)` reverse map helper.

**Type narrowing**

- `dirtyEntityTypes` is now `ReadonlySet<SyncedEntityType>` across the validator, materializer registry, and materializers.
- Dropped `& Record<string, unknown>` from every `DocumentTypeMap` entry. Tests that relied on the loose intersection were rewritten to mutate real schema fields (`doc.system.name`).
- `session-types.ts` header narration trimmed.

**Docs & tests**

- Documented `diffEntities` dedupe-last-write-wins invariant.
- Stripped `(sync-xxxx)` suffixes from six test titles, replaced three "legacy behaviour" comments with "default (no dirty filter)", removed four narration comments.
- Added tests: tombstone × empty-dirty-set; `diffEntities` golden vector + duplicate-id dedupe; `getTypedSession` wrong-type error path; updated `applyLocalChange` mismatch test to expect `DocumentTypeMismatchError`.

**Bean hygiene**

- `api-c43q`: updated to past-tense note that `VERIFY_ENVELOPE_SIGNATURES` was removed by sync-ge3a.
- `api-l6w0`: added a trailing note that sync-ge3a removed the env var entirely.
- Created `sync-xjfi`: follow-up to wire `materializerRegistry.materialize` into a data-layer write path.

**Verification**

- `/verify` full suite: format, lint, typecheck, unit, integration, e2e, e2e-slow, sp-import, pk-import all PASS.
- `grep verifyKeyBinding packages/sync` → zero hits.
- `grep "& Record<string, unknown>" session-types.ts` → zero hits.
- `grep "legacy behaviour" packages/sync` → zero hits.
- `grep "\\(sync-[a-z0-9]{4}\\)" packages/sync/src` in describe/it titles → zero hits.
