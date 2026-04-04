---
# ps-wv47
title: Friend dashboard hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:39Z
updated_at: 2026-04-04T16:00:44Z
parent: ps-sxcy
---

Friend-side data viewing, export manifest

Uses trpc.friend.\* for friend-side data viewing. **REST exception:** export manifest/pages use REST client for ETag-based conditional caching.

## Summary of Changes\n\nAdded friend dashboard hook with T2 bucket key decryption, friend export hooks with REST ETag caching, BucketKeyProvider, RestClientProvider, listReceivedKeyGrants bulk endpoint (tRPC + REST), and T2 decode helpers.
