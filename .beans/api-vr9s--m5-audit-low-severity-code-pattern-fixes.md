---
# api-vr9s
title: M5 audit low-severity code pattern fixes
status: completed
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T12:20:45Z
parent: ps-106o
---

Batch of low-severity code pattern findings from M5 audit.

## Tasks

- [x] L1: Add parseQuery functions to 5 M5 services (board-message, note, poll, poll-vote, acknowledgement)
- [x] L2: Move webhook delivery worker constants (DELIVERY_TIMEOUT_MS, HTTP_SUCCESS_MIN/MAX) to service.constants.ts
- [x] L3: Extract inline 'https://' magic string to WEBHOOK_REQUIRED_PROTOCOL constant
- [x] L4: Change confirmAcknowledgement from .parse() to .safeParse() with explicit error
- [x] L5: Add named constants for poll status literals ('open'/'closed')

## Summary of Changes

- Added parseQuery functions with safeParse + ApiHttpError to board-message, note, poll, poll-vote, and acknowledgement services; updated route handlers to use them
- Moved 6 inline constants from webhook-delivery-worker.ts to service.constants.ts
- Extracted https:// magic string to WEBHOOK_REQUIRED_PROTOCOL constant
- Changed confirmAcknowledgement from .parse() to .safeParse() with explicit error
- Added POLL_STATUS_OPEN/POLL_STATUS_CLOSED constants; replaced 6 hardcoded status literals
