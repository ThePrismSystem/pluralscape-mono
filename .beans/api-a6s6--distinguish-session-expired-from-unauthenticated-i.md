---
# api-a6s6
title: Distinguish SESSION_EXPIRED from UNAUTHENTICATED in REST middleware
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:29:02Z
updated_at: 2026-04-16T06:35:32Z
parent: ps-ai5y
---

AUDIT [API-S-H1] validateSession returns SESSION_EXPIRED or UNAUTHENTICATED but REST middleware collapses both to generic 401. Handled correctly in WebSocket but not REST. File: apps/api/src/middleware/auth.ts:81-83

## Summary of Changes

Changed REST auth middleware to pass through the specific error from validateSession instead of always using UNAUTHENTICATED. Expired sessions now return error code SESSION_EXPIRED with message 'Session has expired', while invalid/revoked sessions continue to return UNAUTHENTICATED. Updated existing test assertion to verify the distinct error codes.
