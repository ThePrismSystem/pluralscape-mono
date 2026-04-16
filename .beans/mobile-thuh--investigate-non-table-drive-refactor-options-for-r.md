---
# mobile-thuh
title: Investigate non-table-drive refactor options for row-transforms.test.ts
status: scrapped
type: task
priority: low
created_at: 2026-04-08T02:02:26Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-h2gl
---

During PR #399 review-fix work (ps-1o81), an attempt was made to table-drive apps/mobile/src/data/**tests**/row-transforms.test.ts based on a review suggestion. The refactor was scrapped because the original suggestion was based on a misread of the file's structure.

## What the review suggested

> row-transforms.test.ts (747 lines) is table-driven-able. ~25 rowToX functions each with ~2 tests doing the same field-by-field expect. A shared testRowTransform(fn, happyRow, expectedEntity) helper would cut 60% of the file.

## What we found

1. **File is actually 2003 lines**, not 747 — the reviewer was looking at the diff size (PR #399 additions), not the total.
2. **Tests do NOT use expect(result).toEqual(expectedFullObject)**. They use per-property assertions like expect(result.id).toBe(...) across 10-15 fields per test.
3. **Return types are branded unions** like Member | Archived<Member>. Tests use type narrowing (if (result.archived) { expect(result.archivedAt)... }) to access discriminated fields. A full-object .toEqual() match can't be expressed without reconstructing brand/union structure in test code.
4. **Privacy-critical code**: row-transforms.ts is where fail-closed privacy invariants live (intToBoolFailClosed etc). Any assertion refactor must preserve precision.

## Alternative refactor options (not pursued)

If future work wants to reduce boilerplate in this file:

- **Option B — Row builders**: Extract buildMemberRow(overrides), buildFrontingSessionRow(overrides) helpers. Reduces row-CONSTRUCTION duplication (the real source of verbosity).
- **Option C — Assert-callback helper**: testRowTransform(name, fn, cases) where each case has assertResult: (result) => void callback. Preserves per-property style. Modest savings (~150-250 lines off 2003).

## Decision

Scrapped from PR #399 review fixes. File stays as-is. If someone wants to pursue B or C later, they need a fresh design pass — do not re-run the original plan verbatim.

## References

- Scrapped from plan: docs/superpowers/plans/2026-04-07-pr-399-review-fixes.md (Task 6)
- Parent work: ps-1o81 (PR #399 review fixes)
- Original reviewer finding: PR #399 multi-agent review
