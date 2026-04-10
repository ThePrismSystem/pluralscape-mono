---
# ps-bkb0
title: "F-003: Fix customFields Zod schema type and order mismatches"
status: todo
type: bug
priority: high
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-10T21:05:28Z
parent: ps-n0tq
---

SPCustomFieldSchema uses z.string().min(1) for type but SP uses numeric 0-7, and NonNegInt for order but SP uses fractional-index strings. Both cause every custom field to fail validation against real SP data. File: sp-payload.ts:106-107.
