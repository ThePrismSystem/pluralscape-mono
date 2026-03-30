---
# api-xkqk
title: Add account PIN management and viewer account settings
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:25Z
updated_at: 2026-03-30T01:01:45Z
parent: api-e7gt
---

Two gaps:

1. Account-level PIN management missing — PIN routes exist only under systems/:systemId/settings/pin, not at /account/pin
2. Viewer account settings — PUT /account/settings only manages auditLogIpTracking; no encrypted data store for viewer-type accounts (therapists/friends) per ADR-021

Audit ref: Domain 2, gaps 2-3

## Summary of Changes\n\n- Created account-pin.service.ts with set/remove/verify using Argon2id\n- Created account/pin/ routes (set-pin, remove-pin, verify-pin)\n- 9 unit tests
