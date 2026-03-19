---
# api-psux
title: Document or deduplicate route-specific pagination constants
status: todo
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-19T11:39:42Z
parent: api-765x
---

L3: Several routes define their own DEFAULT/MAX limit constants. Document the rationale or consolidate into shared constants.

## Acceptance Criteria

- Audit all route-specific pagination constants across the API
- Either consolidate into shared constants file with JSDoc rationale, or add JSDoc to each route-specific constant explaining why it differs
- No behavioral change to pagination defaults
