---
# ps-bkb0
title: "F-003: Fix customFields Zod schema type and order mismatches"
status: completed
type: bug
priority: high
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-11T21:31:20Z
parent: ps-n0tq
---

SPCustomFieldSchema uses z.string().min(1) for type but SP uses numeric 0-7, and NonNegInt for order but SP uses fractional-index strings. Both cause every custom field to fail validation against real SP data. File: sp-payload.ts:106-107.

## Summary of Changes

Fixed `SPCustomFieldSchema` to match real SP data shape (verified against upstream ApparyllisOrg/SimplyPluralApi customFields AJV schema).

- `type`: `z.string().min(1)` to `z.number().int().min(0).max(7)` matching SP's `CustomFieldType` enum (0=text, 1=color, 2-7=date variants).
- `order`: `NonNegInt` to `z.union([z.string().min(1), z.number()]).transform(...)` accepting fractional-index strings post-migration and coercing pre-migration numeric orders.
- `SPCustomField` interface updated: `type: number`, `order: string`.
- `mapFieldDefinition` rewritten with `SP_TYPE_NUMERIC_MAP` and `fractionalIndexToOrder()` (base-36 prefix decode preserving lexicographic order).
- Test fixtures in `test-fixtures/` and `scripts/build-fixtures.ts` updated to new shape.
- Added validator tests for numeric type bounds, legacy string type rejection, and numeric order coercion.
