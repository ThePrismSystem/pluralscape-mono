---
# api-ca7z
title: PIN hash management
status: in-progress
type: task
priority: normal
created_at: 2026-03-16T11:56:58Z
updated_at: 2026-03-17T20:42:22Z
parent: api-6fv1
blocked_by:
  - api-48ip
---

POST .../settings/pin (set — Argon2id hash, 4-6 digits). DELETE .../settings/pin (remove). POST .../settings/pin/verify. Check constraint enforces $argon2id$ prefix.
