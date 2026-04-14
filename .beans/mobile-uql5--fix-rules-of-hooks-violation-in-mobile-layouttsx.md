---
# mobile-uql5
title: Fix Rules of Hooks violation in mobile _layout.tsx
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:29:04Z
updated_at: 2026-04-14T09:29:04Z
---

AUDIT [MOBILE-P-H1] useCallback at line 227 defined after early returns at lines 219/223. Conditional hook call violates Rules of Hooks. Must hoist above early returns. File: apps/mobile/app/\_layout.tsx
