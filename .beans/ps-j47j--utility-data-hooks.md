---
# ps-j47j
title: Utility data hooks
status: todo
type: epic
priority: normal
created_at: 2026-03-31T23:12:54Z
updated_at: 2026-04-03T02:23:45Z
parent: ps-7j8n
---

Search, API key management, audit log, lifecycle events, media upload, account management (deletion, PIN, device transfer)

## Transport

All hooks use tRPC via trpc.system.search, trpc.apiKey._, trpc.lifecycleEvent._, trpc.blob._, trpc.account._.

**REST exception:** blob upload/download URL generation uses REST client for presigned URL handling.
