---
# mobile-uql5
title: Fix Rules of Hooks violation in mobile _layout.tsx
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:29:04Z
updated_at: 2026-04-16T06:35:32Z
parent: ps-ai5y
---

AUDIT [MOBILE-P-H1] useCallback at line 227 defined after early returns at lines 219/223. Conditional hook call violates Rules of Hooks. Must hoist above early returns. File: apps/mobile/app/\_layout.tsx

## Summary of Changes

Moved `useCallback` (getToken) above early returns in `_layout.tsx`. The hook was at line 227, after early returns at lines 219 and 223, violating Rules of Hooks. Added a null guard inside the callback since `tokenStore` may be null before the early return filters it out. The guard is defensive only — the callback is never invoked when tokenStore is null because the early return prevents provider rendering.
