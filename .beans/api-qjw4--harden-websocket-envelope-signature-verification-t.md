---
# api-qjw4
title: Harden WebSocket envelope signature verification toggle
status: completed
type: task
priority: low
created_at: 2026-03-24T21:49:43Z
updated_at: 2026-03-24T21:59:03Z
parent: ps-8al7
---

Server-side envelope signature verification can be disabled via env var. Log WARN when disabled, consider removing the toggle entirely.

**Audit ref:** Finding 10 (LOW) — A08 Software Integrity / Tampering
**File:** apps/api/src/ws/handlers.ts:368-371

## Summary of Changes

Added one-time WARN log in shouldVerifyEnvelopeSignatures() when VERIFY_ENVELOPE_SIGNATURES is disabled. Uses module-level flag to avoid log spam.
