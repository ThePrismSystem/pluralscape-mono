---
# api-uiqy
title: Add recovery-key password reset endpoint
status: todo
type: feature
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

Only GET /status and POST /regenerate exist for recovery keys. Password reset via recovery key has crypto primitives in packages/crypto/src/password-reset.ts but no API endpoint. Add POST /auth/password-reset/recovery-key (unauthenticated). Ref: audit S-8.
