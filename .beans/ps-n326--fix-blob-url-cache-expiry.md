---
# ps-n326
title: Fix blob URL cache expiry
status: completed
type: bug
priority: high
created_at: 2026-04-06T00:52:54Z
updated_at: 2026-04-06T05:15:53Z
parent: ps-y621
---

useBlobDownloadUrl returns presigned URLs that expire but has no short staleTime or gcTime. Default 30s staleTime means cache serves expired URLs on remount.

Fix: set staleTime/gcTime matching URL expiry, or cacheTime: 0.

File: apps/mobile/src/hooks/use-blobs.ts:27-32,:50-58
Audit ref: Pass 3 HIGH

## Summary of Changes\n\nSet staleTime: 0 and gcTime: 5min on blob download URL queries to prevent serving expired presigned URLs.
