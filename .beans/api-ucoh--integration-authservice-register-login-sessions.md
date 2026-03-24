---
# api-ucoh
title: "Integration: auth.service (register, login, sessions)"
status: completed
type: task
priority: critical
created_at: 2026-03-24T12:46:25Z
updated_at: 2026-03-24T13:27:48Z
parent: api-av4w
---

PGlite integration tests for auth service: registration with crypto, login with password verification, session CRUD, idle timeout

## Summary of Changes\n\nCreated auth.service.integration.test.ts with 7 tests: register, duplicate email, login (correct/wrong/nonexistent), listSessions, revokeSession.
