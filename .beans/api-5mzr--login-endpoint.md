---
# api-5mzr
title: Login endpoint
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:52:30Z
updated_at: 2026-03-17T00:02:46Z
parent: api-o89k
blocked_by:
  - api-1v5r
---

POST /auth/login: verify Argon2id hash, create session with platform-appropriate TTLs (web: 30d/7d, mobile: 90d/30d via client hint). Generic error on failure (no user enumeration). Audit log for success and failure. Rate limited at authHeavy.

## Todo

- [x] Add loginAccount() to auth.service.ts
- [x] Create login.ts route handler
- [x] Add login route to auth/index.ts
- [x] Write login unit tests (mocked DB)

## Summary of Changes

Login endpoint (POST /auth/login) with Argon2id verification, platform-aware session TTLs, anti-timing via dummy hash, audit logging for success/failure.
