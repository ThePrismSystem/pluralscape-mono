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

## Summary of Changes\n\nAddressed all 13 review findings from PR #220:\n\n### Important fixes\n- Aligned ciphertext byte length (64→32) across all test fixtures\n- Fixed WS connection leak in createAuthenticatedWsClient on auth failure\n- Changed fragile Last-Event-ID from 999999 to Number.MAX_SAFE_INTEGER\n- Fixed unsubscribe race condition with subscribe barrier pattern\n- Fixed readSseUntil to throw on stream EOF instead of silent return\n- Fixed SyncWsClient.close() to reject pending waiters instead of orphaning\n\n### Suggestions implemented\n- Extracted withSseStream helper to eliminate AbortController boilerplate\n- Renamed HEARTBEAT_WAIT_MS to SSE_HEARTBEAT_TIMEOUT_MS\n- Added assertMessageType helper for proper TypeScript narrowing\n- Renamed AuthenticatedWsClient.client to .ws\n- Consolidated duplicate base64urlOfLength across 4 files\n- Extracted WireChangePayload named interface\n- Removed double blank line in imports
