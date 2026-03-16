---
# api-5mzr
title: Login endpoint
status: in-progress
type: task
priority: normal
created_at: 2026-03-16T11:52:30Z
updated_at: 2026-03-16T23:21:09Z
parent: api-o89k
blocked_by:
  - api-1v5r
---

POST /auth/login: verify Argon2id hash, create session with platform-appropriate TTLs (web: 30d/7d, mobile: 90d/30d via client hint). Generic error on failure (no user enumeration). Audit log for success and failure. Rate limited at authHeavy.

## Todo

- [x] Add loginAccount() to auth.service.ts
- [x] Create login.ts route handler
- [x] Add login route to auth/index.ts
- [ ] Write login integration tests
