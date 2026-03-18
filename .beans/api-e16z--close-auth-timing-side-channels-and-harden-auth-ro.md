---
# api-e16z
title: Close auth timing side-channels and harden auth routes
status: todo
type: task
priority: high
created_at: 2026-03-18T20:09:00Z
updated_at: 2026-03-18T20:09:00Z
parent: api-mzn0
---

Security fixes: add fire-and-forget audit write to email-not-found branch for timing equalization, remove redundant ZodError catches in auth routes, refactor sessions.ts triple .use() to router-level auth.

## TODO

- [ ] Add fire-and-forget audit write to email-not-found branch in auth.service.ts
- [ ] Remove redundant ZodError try/catch in register.ts
- [ ] Remove redundant ZodError try/catch in login.ts
- [ ] Remove redundant ZodError try/catch in password-reset.ts
- [ ] Refactor sessions.ts triple .use() to router-level auth
- [ ] Add test for email-not-found audit event
- [ ] Update affected auth route tests
- [ ] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api
