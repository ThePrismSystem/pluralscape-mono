---
# api-lm4o
title: Type c.get("auth") via Hono Variables generic
status: todo
type: task
created_at: 2026-04-21T13:58:21Z
updated_at: 2026-04-21T13:58:21Z
parent: ps-0vwf
---

Enforce at the type level that Hono route handlers can only call c.get("auth") after the auth middleware has run. Eliminates the current reliance on implicit middleware ordering.

## Context

apps/api/src/routes/\*_/_.ts currently use c.get("auth") without any type-level guarantee that authMiddleware() ran first. A developer who forgets app.use("\*", authMiddleware()) before a protected route gets runtime undefined behavior — the handler reads auth as undefined and often silently breaks RLS because the context GUCs never get set.

Hono supports a Variables generic on Context that lets middleware declare what it adds. Switching every protected route group to typed Context turns middleware-ordering bugs into compile errors.

## Scope

- [ ] Define AuthEnv = { Variables: { auth: AuthenticatedSession } } in apps/api/src/lib/auth-context.ts (already exists for some routes — standardize)
- [ ] Type every Hono sub-app that uses c.get("auth") as Hono<AuthEnv>
- [ ] Remove any existing `as AuthenticatedSession` or `!` non-null assertions on c.get("auth") return values — they become unnecessary
- [ ] Ensure the auth middleware sets the typed variable via c.set("auth", session)
- [ ] Document the pattern in CONTRIBUTING.md's "Adding API Endpoints" section

## Out of scope

- Public (unauthenticated) routes
- tRPC procedures (already have typed ctx.auth)

## Acceptance

- pnpm typecheck passes
- Deleting c.use("\*", authMiddleware()) from any protected sub-app causes a type error in the downstream handler
- pnpm test:e2e passes (no behavioral regression)
