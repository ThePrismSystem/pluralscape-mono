---
# api-ex51
title: Increase device transfer code to 10+ digits
status: completed
type: task
priority: normal
created_at: 2026-03-21T00:34:19Z
updated_at: 2026-03-21T11:14:30Z
parent: api-0zl4
blocked_by:
  - ps-38gq
---

M4 implementation: increase transfer code from 8 to 10+ digits for better offline brute-force resistance. Needs UX design for code entry flow.

## Summary of Changes\n\nIncreased transfer code from 8 to 10 digits (~33.2 bits entropy). Rewrote `generateUniformCode()` to use 8-byte BigInt rejection sampling for the larger code space. Updated Zod schema, validation pattern, and JSDoc security model.
