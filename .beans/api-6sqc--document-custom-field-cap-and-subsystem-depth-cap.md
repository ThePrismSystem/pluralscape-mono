---
# api-6sqc
title: Document custom field cap and subsystem depth cap
status: completed
type: task
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T08:12:38Z
parent: api-i2pw
---

Custom fields capped at 200 despite unlimited feature wording. Subsystem nesting capped at 50 despite no hard depth limit. Document these caps or remove. Ref: audit L-1, L-2.

## Summary of Changes\n\nAdded JSDoc to MAX_FIELD_DEFINITIONS_PER_SYSTEM and both MAX_ANCESTOR_DEPTH constants. Updated features.md: unlimited -> up to 200 fields, no hard depth limit -> depth capped at 50.
