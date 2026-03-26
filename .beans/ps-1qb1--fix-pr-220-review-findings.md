---
# ps-1qb1
title: Fix PR 220 review findings
status: completed
type: task
priority: normal
created_at: 2026-03-21T04:53:30Z
updated_at: 2026-03-21T04:57:12Z
---

Address all 13 review findings (6 important + 7 suggestions) from PR #220 E2E test review

## Summary of Changes

Addressed all 13 review findings from PR #220:

### Important fixes

- Aligned ciphertext byte length (64→32) across all test fixtures
- Fixed WS connection leak in createAuthenticatedWsClient on auth failure
- Changed fragile Last-Event-ID from 999999 to Number.MAX_SAFE_INTEGER
- Fixed unsubscribe race condition with subscribe barrier pattern
- Fixed readSseUntil to throw on stream EOF instead of silent return
- Fixed SyncWsClient.close() to reject pending waiters instead of orphaning

### Suggestions implemented

- Extracted withSseStream helper to eliminate AbortController boilerplate
- Renamed HEARTBEAT_WAIT_MS to SSE_HEARTBEAT_TIMEOUT_MS
- Added assertMessageType helper for proper TypeScript narrowing
- Renamed AuthenticatedWsClient.client to .ws
- Consolidated duplicate base64urlOfLength across 4 files
- Extracted WireChangePayload named interface
- Removed double blank line in imports
