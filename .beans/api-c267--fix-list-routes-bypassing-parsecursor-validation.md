---
# api-c267
title: Fix list routes bypassing parseCursor validation
status: scrapped
type: bug
priority: high
created_at: 2026-03-26T07:42:25Z
updated_at: 2026-03-26T07:55:16Z
parent: ps-106o
---

5 M5 list routes pass raw cursor strings directly to the service layer without calling parseCursor(), bypassing HMAC tamper detection and TTL expiration checks.

## Files

- routes/board-messages/list.ts:29
- routes/notes/list.ts:31
- routes/polls/list.ts:29
- routes/polls/list-votes.ts:29
- routes/acknowledgements/list.ts:29

## Fix

Import parseCursor from ../../lib/pagination.js and wrap the raw query param before passing to the service.

## Tasks

- [ ] Add parseCursor to all 5 list routes
- [ ] Add unit tests verifying cursor validation at route level

## Reasons for Scrapping

During implementation planning, this was found to be a **false positive**. All 6 M5 list routes pass raw cursor strings to their service layers, but every service calls `fromCompositeCursor()` internally (which calls `fromCursor()` with full HMAC validation + TTL expiry checks). The M5 services use composite cursors (sort value + entity ID pairs) rather than simple cursors, so calling `parseCursor()` at the route layer would be architecturally incorrect — it decodes to a simple entity ID, losing the composite structure. The cursor validation IS happening, just in the service layer rather than the route layer, which is the correct pattern for composite cursors.
