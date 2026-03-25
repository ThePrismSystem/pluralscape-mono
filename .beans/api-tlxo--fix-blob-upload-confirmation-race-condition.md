---
# api-tlxo
title: Fix blob upload confirmation race condition
status: completed
type: bug
priority: normal
created_at: 2026-03-24T21:49:21Z
updated_at: 2026-03-24T22:01:15Z
parent: ps-8al7
---

Blob upload confirmation checks uploadedAt === null outside a transaction (TOCTOU). Move check inside transaction with FOR UPDATE lock.

**Audit ref:** Finding 8 (MEDIUM) — A04 Insecure Design / Tampering
**File:** apps/api/src/services/blob.service.ts (upload confirmation)

## Summary of Changes

Added .for("update") to blob metadata SELECT in confirmUpload transaction.
