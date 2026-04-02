---
# api-1hfd
title: tRPC comprehensive audit — rate limiting, parity, E2E, docs
status: completed
type: task
priority: normal
created_at: 2026-04-02T19:44:35Z
updated_at: 2026-04-02T21:01:11Z
---

Bring tRPC to full parity with REST before mobile consumption. Rate limiting, CI parity script, gap fixes, response shape audit, code dedup, E2E tests, ADR 032, consumer guide, and final polish.

## Tasks

- [x] Task 1: Rate limiting parity — auth router (authHeavy for register/login, authLight for sessions)
- [x] Task 2: Rate limiting parity — all 33 remaining routers
- [x] Task 3: CI parity script — auto-discovery (5 checks + allowlist)
- [x] Task 4: Fix remaining gaps + response shape audit (manual)
- [x] Task 5: Code deduplication (shared mocks, validation schema audit)
- [x] Task 6: Lightweight tRPC E2E tests (auth, CRUD, fronting, transport edge cases)
- [x] Task 7: Documentation (ADR 032, trpc-guide.md)
- [x] Task 8: Final polish (error consistency, deployment guard, client readiness, dead code)

## Summary of Changes

- Added rate limiting to all 35 tRPC routers matching REST categories
- Built CI parity script checking 5 dimensions (existence, rate limits, auth levels, input validation, idempotency)
- Fixed response shape divergence (revokeAllSessions field name)
- Centralized shared test mocks (MOCK_AUTH, MOCK_SYSTEM_ID)
- Created tRPC E2E tests (auth, member CRUD, fronting, transport edge cases)
- Added ADR 032 and tRPC consumer guide
- Deferred tRPC idempotency (not best practice for internal typed clients)
