---
# api-1v5r
title: Registration endpoint
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:52:27Z
updated_at: 2026-03-16T11:52:27Z
parent: api-o89k
---

POST /auth/register: create account (Argon2id hash, emailHash+salt, kdfSalt), create system, generate keypair (encryption + signing authKeys), generate recovery key, create initial session. Support system and viewer account types (ADR 021). Rate limited at authHeavy (5/60s).
