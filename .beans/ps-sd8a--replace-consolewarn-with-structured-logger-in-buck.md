---
# ps-sd8a
title: Replace console.warn with structured logger in bucket-key-provider
status: completed
type: task
priority: low
created_at: 2026-04-06T00:53:09Z
updated_at: 2026-04-06T09:45:38Z
parent: ps-y621
---

apps/mobile/src/providers/bucket-key-provider.tsx:79 uses console.warn in production code logging grant decryption failures. Passes full error object which may include stack traces or contextual crypto data.

Fix: use structured logger or telemetry sink. Log only err.message to avoid leaking diagnostic details.

Audit ref: Pass 2 MEDIUM + Pass 7 MEDIUM (cross-cutting)

## Summary of Changes

Replaced globalThis.console.warn logging full error object with message-only interpolation using instanceof Error check.
