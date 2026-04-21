---
# ps-0vwf
title: Closeout quick wins
status: in-progress
type: epic
created_at: 2026-04-21T13:54:51Z
updated_at: 2026-04-21T13:54:51Z
parent: ps-cd6x
---

Small, tightly-scoped hygiene and regression-prevention tasks that surfaced during the 2026-04-21 brutal audit and verification pass. Each child is a 1-2 day effort.

## Children (see child task beans)

1. Type c.get("auth") via Hono Variables<{ auth: AuthenticatedSession }> generic — compile-time guarantee that auth middleware ran before the handler executes.
2. RLS-helper lint rule + integration test — forbid bare db.execute/db.transaction outside lib/rls-context.ts; integration test asserts a query without setTenantContext throws rather than returning [].
3. Extract apps/mobile/src/**tests**/factories.ts — shared makeRawPoll, makeRawNote, makeRawSession, etc. Replaces duplicated fixture functions scattered across hook test files.
4. Replace `as never` queue mock in switch-alert-dispatcher.integration.test.ts:56-77 with typed vi.mocked() double.
5. Add Supersedes / Superseded-by fields to docs/adr/000-template.md; backfill obvious chains (ADR-037 profile split supersedes unified PWHASH\_\*\_UNIFIED constants; etc.).
6. Archive docs/local-audits/ M1-M8 snapshots into history/ subdir; keep 2026-04-14 and 2026-04-20 at top level.
7. Move ANTI_ENUM_SALT_SECRET_DEFAULT + DEV_HMAC_KEY to a dev-only module that env.ts imports dynamically only outside production — defense-in-depth on top of the existing Zod refine guards.
8. CI/pre-commit LOC cap on apps/api/src/services/\*_/_.ts (500-line soft limit) — regression prevention for the service refactor epic.

## Spec reference

docs/superpowers/specs/2026-04-21-m9a-closeout-hardening-design.md
