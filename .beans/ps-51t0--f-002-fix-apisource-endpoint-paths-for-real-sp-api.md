---
# ps-51t0
title: "F-002: Fix ApiSource ENDPOINT_PATHS for real SP API"
status: todo
type: bug
priority: critical
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-10T21:05:28Z
parent: ps-n0tq
---

ENDPOINT_PATHS in api-source.ts:49-65 do not match the real SP API. Multiple paths need :system params, chat endpoints are under /v1/chat/, comments/notes need compound params, and pagination uses limit/offset but SP streams full collections. Blocking for live API import.
