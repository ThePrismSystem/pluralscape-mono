---
# ps-rv13
title: Export InnerWorldCanvasId from types barrel
status: completed
type: bug
priority: low
created_at: 2026-04-06T00:53:09Z
updated_at: 2026-04-06T08:21:10Z
parent: ps-y621
---

InnerWorldCanvasId defined in ids.ts and present in ID_PREFIXES but not re-exported from packages/types/src/index.ts. Violates package import convention.

Audit ref: Pass 8 MEDIUM

## Summary of Changes

Already fixed. InnerWorldCanvasId is exported at packages/types/src/index.ts:34. Resolved by prior M8 work.
