---
# api-lozw
title: tRPC skill-by-skill audit
status: completed
type: task
priority: normal
created_at: 2026-04-03T05:04:55Z
updated_at: 2026-04-03T05:11:33Z
---

Comprehensive audit of all tRPC code against the 12 official tRPC skill documents. Spec: docs/superpowers/specs/2026-04-03-trpc-audit-design.md. Plan: docs/superpowers/plans/2026-04-03-trpc-skill-audit.md.

## Tasks

- [x] Task 0: Create report skeleton
- [x] Tasks 1-7: Tier 1 audits (server-setup, middlewares, error-handling, validators, auth, server-side-calls, trpc-router)
- [x] Tasks 8-9: Tier 2 audits (client-setup, links)
- [x] Tasks 10-12: Tier 3 readiness (subscriptions, non-json-content-types, caching)
- [x] Task 13: Cross-cutting consolidation
- [x] Task 14: Executive summary and bean creation

## Summary of Changes

Completed comprehensive tRPC skill-by-skill audit covering all 12 tRPC skill documents against the codebase.

**Results:** 0 P0 | 3 P1 | 9 P2 | 14 P3

**Beans created:**

- api-8m98: cursor .optional() to .nullish() (P1)
- api-i6ms: errorFormatter for Zod (P1)
- api-5s6k: TRPCError in analytics (P1)
- api-joyk: createContextInner + getHTTPStatusCodeFromError (P2)
- api-trgr: isDev + 422 mapping (P2)
- mobile-fgri: token refresh memoization (P2)
- api-rh7d: batch limits + no-store + headers shape (P2)
- api-3d0y: redundant auth check (P2)

Report: docs/local-audits/2026-04-03-trpc-skill-audit.md
