---
# api-zc0n
title: Mask Zod validation details in all environments
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T18:37:10Z
parent: api-765x
---

M6: Strip detailed Zod error paths from API error responses in production to avoid leaking schema internals.

## Acceptance Criteria

- Production: Zod validation errors return generic message (e.g., 'Invalid request body')
- Development: Zod validation errors return full error paths and details for debugging
- Environment detection via NODE_ENV or equivalent config
- Applies to all routes using Zod validation
- Integration tests: prod mode → generic message; dev mode → full details

## Summary of Changes

Already implemented — `error-handler.ts:94-106` already strips Zod validation details in production.
