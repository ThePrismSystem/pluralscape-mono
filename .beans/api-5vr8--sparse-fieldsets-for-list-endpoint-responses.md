---
# api-5vr8
title: Sparse fieldsets for list endpoint responses
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T18:58:59Z
parent: api-765x
---

M17: Support a fields query parameter on list endpoints to allow clients to request only specific fields, reducing payload size.

## Acceptance Criteria

- List endpoints accept `fields` query parameter (comma-separated field names)
- Response contains only requested fields plus `id` (always included)
- Invalid field name → 400 with error identifying the invalid field
- No `fields` param → full response (backward compatible)
- Applied to: members list, groups list, field definitions list (at minimum)
- Integration tests: subset fields returned; invalid field → 400

## Summary of Changes\n\nImplemented as part of feat/api-hardening-audit-013-remaining.
