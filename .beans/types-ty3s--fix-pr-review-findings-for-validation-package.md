---
# types-ty3s
title: Fix PR review findings for validation package
status: completed
type: task
priority: normal
created_at: 2026-03-16T08:32:41Z
updated_at: 2026-03-16T08:32:52Z
---

Address all actionable findings from PR review of feat/validation-package-scaffold: fix brandedNumber NaN/Infinity bug, add password comments, add edge case and error shape tests, fix ADR text.

## Summary of Changes\n\n- Fixed `brandedNumber` predicate to reject NaN/Infinity via `Number.isFinite()`\n- Added password validation comments in auth schemas\n- Added 5 new edge case tests for branded helpers (whitespace string, zero, NaN, Infinity, -Infinity)\n- Enhanced contract tests with error shape assertions and unknown property stripping\n- Added `recoveryKeyBackupConfirmed: false` acceptance test\n- Fixed ADR 023 text to reflect `z.custom` instead of `as ZodType`
