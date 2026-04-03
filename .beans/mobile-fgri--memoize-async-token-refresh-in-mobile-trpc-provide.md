---
# mobile-fgri
title: Memoize async token refresh in mobile tRPC provider
status: completed
type: task
priority: normal
created_at: 2026-04-03T05:10:54Z
updated_at: 2026-04-03T06:42:46Z
---

trpc-provider.tsx:31 — headers() is async and calls await getToken() on every request with no caching. Concurrent requests each independently refresh tokens. React Query's isFetching can get stuck per the tRPC auth skill's documented race condition.

Memoize the in-flight refresh promise so concurrent calls share one refresh, then clear on resolution.

File: apps/mobile/src/providers/trpc-provider.tsx:31

Source: tRPC auth skill — async headers race condition

## Summary of Changes\n\nAdded createMemoizedTokenGetter to share one in-flight refresh across concurrent requests.
