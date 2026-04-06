---
# ps-rv13
title: Export InnerWorldCanvasId from types barrel
status: todo
type: bug
priority: low
created_at: 2026-04-06T00:53:09Z
updated_at: 2026-04-06T00:53:09Z
parent: ps-y621
---

InnerWorldCanvasId defined in ids.ts and present in ID_PREFIXES but not re-exported from packages/types/src/index.ts. Violates package import convention.

Audit ref: Pass 8 MEDIUM
