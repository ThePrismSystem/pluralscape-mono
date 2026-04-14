---
# sync-3lb6
title: Validate authorPublicKey against authenticated session identity
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:28:37Z
updated_at: 2026-04-14T09:28:37Z
---

AUDIT [SYNC-S-H1] handleSubmitChange verifies envelope signature using envelope.authorPublicKey but never checks it matches the authenticated system's registered signing key. Attacker can submit envelopes claiming any authorPublicKey. File: apps/api/src/ws/handlers.ts
