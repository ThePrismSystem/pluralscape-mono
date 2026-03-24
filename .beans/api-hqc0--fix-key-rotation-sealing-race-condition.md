---
# api-hqc0
title: Fix key rotation sealing race condition
status: completed
type: bug
priority: low
created_at: 2026-03-24T21:49:45Z
updated_at: 2026-03-24T22:01:15Z
parent: ps-8al7
---

Key rotation sealing releases FOR UPDATE lock before content tag check, allowing duplicate audit events from concurrent sealing requests. Extend lock to cover full sealing phase.

**Audit ref:** Finding 11 (LOW) — A04 Insecure Design / Repudiation
**File:** apps/api/src/services/ (bucket rotation)

## Summary of Changes

Added .for("update") to bucketContentTags SELECT during key rotation sealing phase.
