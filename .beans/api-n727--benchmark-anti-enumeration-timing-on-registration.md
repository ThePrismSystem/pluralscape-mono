---
# api-n727
title: Benchmark anti-enumeration timing on registration
status: todo
type: task
priority: low
created_at: 2026-03-17T04:00:54Z
updated_at: 2026-03-17T04:00:54Z
parent: api-o89k
---

ANTI_ENUM_TARGET_MS=500ms. If real registration (Argon2id + key gen + 6 DB inserts) typically exceeds 500ms, the fake path for duplicate emails returns faster, leaking information. Benchmark real registration and adjust target to p95 + buffer.
