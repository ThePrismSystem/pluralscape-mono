---
# ps-10sq
title: "PR #402 review fixes — Plan 2 import-sp engine"
status: completed
type: task
priority: normal
created_at: 2026-04-09T20:40:14Z
updated_at: 2026-04-10T00:11:59Z
parent: ps-nrg4
---

Execution tracker for the PR #402 multi-agent review fixes plan. Addresses 9 critical, ~15 important, ~15 suggestion findings via 44 tasks across 6 phases on feat/simply-plural-import-engine. Plan: docs/superpowers/plans/2026-04-09-pr-402-review-fixes.md. Spec: docs/superpowers/specs/2026-04-09-pr-402-review-fixes-design.md.

## Summary of Changes

All 44 tasks from the PR #402 review fixes plan implemented across 6 phases:

**Phase 0 (T1-T10):** Foundation — follow-up beans, web-globals shim removal, ImportSourceFormat rename, ImportFailureKind union, friends/friend-requests dropped, db enum re-export, test renames, redundant test cleanup

**Phase 1 (T11-T16):** Type safety — named Mapped<Entity> exports, PersistableEntity discriminated union, selectedCategories typed end-to-end, assertBrandedTargetId helper, import-entity-ref service refactor, in-memory persister enhancement

**Phase 2 (T17-T27):** Surprise policy — warnUnknownKeys + passthrough Zod validators, FK-miss fail-closed across 6 mappers (chat-message, channel, group, poll, fronting-session, system-profile), API source Permanent/Transient split, warnings-truncated marker, dropped-collection warning, dispatch-level unknown-field wiring, e2e surprise policy tests

**Phase 3 (T28-T31):** Bucket flow — reproducing tests for 3 criticals, dead reusedPluralscapeId removal, synthesized bucket count/flush/advance, member bucket refs via translation table (fail-closed)

**Phase 4 (T32-T34):** File source streaming — clarinet SAX parser with accumulator stack, TextDecoder stream-safe UTF-8, source.close() try/finally

**Phase 5 (T35-T43):** Cleanup — exhaustive switch, dead constants, engine lifecycle helpers, comment cleanup, README expansion, sub-barrel index.ts

**Test counts:** 270 passed + 1 skipped (37 files). Cross-package typecheck clean (import-sp, types, db, api).

**Quality review findings addressed:** 15+ important/critical issues fixed inline during two-stage reviews after each batch.
