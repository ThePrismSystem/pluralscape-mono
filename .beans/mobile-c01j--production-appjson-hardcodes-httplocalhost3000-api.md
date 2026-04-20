---
# mobile-c01j
title: Production app.json hardcodes http://localhost:3000 apiBaseUrl
status: completed
type: bug
priority: critical
created_at: 2026-04-20T09:21:02Z
updated_at: 2026-04-20T18:47:46Z
parent: mobile-e3l7
---

Finding [CRIT-1] from audit 2026-04-20. apps/mobile/app.json:23. Prod build without override communicates over plaintext HTTP, bypassing ws:// guard (WS-only check). Fix: remove apiBaseUrl from app.json; require eas.json/env-specific config injection.

## Summary of Changes

Removed hardcoded http://localhost:3000 from apps/mobile/app.json. Production and preview apiBaseUrl values now ship via eas.json per-profile extras (production: https://api.pluralscape.app, preview: https://api-preview.pluralscape.app). Development profile keeps http://localhost:3000 for the local emulator.

apps/mobile/src/config.ts now requires an apiBaseUrl value and throws on:

- missing or non-string values
- http:// in a non-dev build (production/preview)
- http:// in a dev build for a non-loopback host
- unsupported schemes

Added apps/mobile/.env.example documenting the eas.json injection path and added a unit test covering every branch of the loader.
