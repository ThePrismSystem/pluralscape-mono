---
# api-1hfd
title: tRPC comprehensive audit — rate limiting, parity, E2E, docs
status: in-progress
type: task
priority: normal
created_at: 2026-04-02T19:44:35Z
updated_at: 2026-04-02T19:49:11Z
---

Bring tRPC to full parity with REST before mobile consumption. Rate limiting, CI parity script, gap fixes, response shape audit, code dedup, E2E tests, ADR 032, consumer guide, and final polish.

## Tasks

- [x] Task 1: Rate limiting parity — auth router (authHeavy for register/login, authLight for sessions)
- [ ] Task 2: Rate limiting parity — all 33 remaining routers
- [ ] Task 3: CI parity script — auto-discovery (5 checks + allowlist)
- [ ] Task 4: Fix remaining gaps + response shape audit (manual)
- [ ] Task 5: Code deduplication (shared mocks, validation schema audit)
- [ ] Task 6: Lightweight tRPC E2E tests (auth, CRUD, fronting, transport edge cases)
- [ ] Task 7: Documentation (ADR 032, trpc-guide.md)
- [ ] Task 8: Final polish (error consistency, deployment guard, client readiness, dead code)
