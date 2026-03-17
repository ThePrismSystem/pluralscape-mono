---
# api-n727
title: Benchmark anti-enumeration timing on registration
status: completed
type: task
priority: low
created_at: 2026-03-17T04:00:54Z
updated_at: 2026-03-17T05:36:56Z
parent: api-o89k
---

ANTI_ENUM_TARGET_MS=500ms. If real registration (Argon2id + key gen + 6 DB inserts) typically exceeds 500ms, the fake path for duplicate emails returns faster, leaking information. Benchmark real registration and adjust target to p95 + buffer.

## Summary of Changes\n\nCreated registration-timing.bench.ts — a manual benchmark tool that runs 20+ registration trials and reports p50/p95/p99 latencies against ANTI_ENUM_TARGET_MS. Warns if timing would leak email existence. Not a CI test — requires running PostgreSQL.
