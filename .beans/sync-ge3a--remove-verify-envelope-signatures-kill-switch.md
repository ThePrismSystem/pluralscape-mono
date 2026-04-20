---
# sync-ge3a
title: Remove VERIFY_ENVELOPE_SIGNATURES kill-switch
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [H1] from audit 2026-04-20. apps/api/src/ws/envelope-verification-config.ts:8-19. Env var disables all server-side Ed25519 signature checks on changes and snapshots. Operator misconfiguration silently allows unsigned/forged envelopes. Fix: always-on verification; remove kill-switch or gate on build-time flag for test infra only.
