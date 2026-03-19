---
# api-e16z
title: Close auth timing side-channels and harden auth routes
status: completed
type: task
priority: high
created_at: 2026-03-18T20:09:00Z
updated_at: 2026-03-19T00:44:54Z
parent: api-mzn0
---

Security fixes: add fire-and-forget audit write to email-not-found branch for timing equalization, remove redundant ZodError catches in auth routes, refactor sessions.ts triple .use() to router-level auth.

## TODO

- [x] Add fire-and-forget audit write to email-not-found branch in auth.service.ts
- [x] Remove redundant ZodError try/catch in register.ts
- [x] Remove redundant ZodError try/catch in login.ts
- [x] Remove redundant ZodError try/catch in password-reset.ts
- [x] Refactor sessions.ts triple .use() to router-level auth
- [x] Add test for email-not-found audit event
- [x] Update affected auth route tests
- [x] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api
