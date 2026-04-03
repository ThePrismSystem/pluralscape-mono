---
# ps-sxcy
title: Social data hooks
status: todo
type: epic
priority: normal
created_at: 2026-03-31T23:12:49Z
updated_at: 2026-04-03T02:23:42Z
parent: ps-7j8n
---

Privacy buckets, friend network, push notification config, external dashboard, friend search

## Transport

All hooks use tRPC via trpc.bucket._, trpc.friend._, trpc.friendCode._, trpc.notificationConfig._, trpc.deviceToken.\*.

**REST exception:** friend export manifest/pages use REST client for ETag-based conditional caching (304 Not Modified).
