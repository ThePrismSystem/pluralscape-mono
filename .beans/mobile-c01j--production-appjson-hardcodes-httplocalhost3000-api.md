---
# mobile-c01j
title: Production app.json hardcodes http://localhost:3000 apiBaseUrl
status: todo
type: bug
priority: critical
created_at: 2026-04-20T09:21:02Z
updated_at: 2026-04-20T09:21:02Z
parent: mobile-e3l7
---

Finding [CRIT-1] from audit 2026-04-20. apps/mobile/app.json:23. Prod build without override communicates over plaintext HTTP, bypassing ws:// guard (WS-only check). Fix: remove apiBaseUrl from app.json; require eas.json/env-specific config injection.
