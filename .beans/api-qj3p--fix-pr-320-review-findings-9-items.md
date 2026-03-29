---
# api-qj3p
title: "Fix PR #320 review findings (9 items)"
status: completed
type: task
priority: normal
created_at: 2026-03-29T11:24:21Z
updated_at: 2026-03-29T11:59:57Z
---

Fix 1 critical, 3 important, and 5 suggestion findings from PR #320 review

## Checklist

- [x] Step 1: Fix host throttle livelock (CRITICAL) — bump nextRetryAt when throttled
- [x] Step 2: Remove duplicate CHECK constraint — regenerate migrations + RLS
- [x] Step 3: Restore error distinction in testWebhookConfig — timeout vs network
- [x] Step 4: Fix stale HTTPS enforcement tests — replace env manipulation with direct URL tests
- [x] Step 5: Extract FetchFn type alias — used in webhook-fetch, delivery-worker, config service
- [x] Step 6: Add assertTemplateVars tests — indirect via processEmailJob
- [x] Step 7: Fix Record<string, string> cast — use toMatchObject pattern
- [x] Step 8: Add debug log for releasing non-acquired hostname
- [x] Step 9: Add trailing newlines to migration SQL files

## Summary of Changes

- Added WEBHOOK_HOST_THROTTLE_DELAY_MS (30s) constant and bumped nextRetryAt when host throttled to prevent livelock
- Removed duplicate webhook_deliveries_payload_check CHECK from PG and SQLite schemas, regenerated migrations and RLS
- Restored timeout vs network error distinction in testWebhookConfig
- Replaced stale NODE_ENV-based HTTPS tests with direct localhost/HTTPS URL coverage (including [::1] fix for Bun)
- Extracted FetchFn type alias shared across webhook modules
- Added assertTemplateVars tests (null, string, undefined, template name in message)
- Replaced Record<string, string> casts with toMatchObject pattern in webhook-fetch tests
- Added debug log for releasing non-acquired hostname in releaseHostSlot
- Fixed trailing newlines in all 4 migration SQL files
- Updated SQLite DDL helper to remove stale archived columns, add payload CHECK, update event types
