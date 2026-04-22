---
# api-4g7w
title: Inline ownerLabel from field-value/internal.ts into set.ts (single-consumer)
status: completed
type: task
priority: normal
created_at: 2026-04-22T02:43:26Z
updated_at: 2026-04-22T07:10:48Z
parent: api-6l1q
---

Discovered during api-6l1q PR 2 findings spot-audit (api-uya3 had no recorded findings).

## Problem

`apps/api/src/services/field-value/internal.ts` exports `ownerLabel(owner: FieldValueOwner): string` but it is only consumed by `services/field-value/set.ts` (used once in an error message). Per the Option E rule ("shared helpers ONLY if used by >=2 verb consumers"), single-consumer helpers should live in the consuming verb file, not in internal.ts.

## Scope

- Move `ownerLabel` from `field-value/internal.ts` into `field-value/set.ts` as a module-local function
- Remove the import in set.ts
- No behavior change

## Acceptance

- `ownerLabel` not exported from internal.ts
- `set.ts` works unchanged
- Verify suite passes

## Summary of Changes

Moved `ownerLabel` from `field-value/internal.ts` into `field-value/set.ts` as a module-local function (single-consumer rule per Option E). Removed the export and import.
