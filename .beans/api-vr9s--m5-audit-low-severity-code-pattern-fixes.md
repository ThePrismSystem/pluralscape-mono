---
# api-vr9s
title: M5 audit low-severity code pattern fixes
status: todo
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T07:43:55Z
parent: ps-106o
---

Batch of low-severity code pattern findings from M5 audit.

## Tasks

- [ ] L1: Add parseQuery functions to 5 M5 services (board-message, note, poll, poll-vote, acknowledgement)
- [ ] L2: Move webhook delivery worker constants (DELIVERY_TIMEOUT_MS, HTTP_SUCCESS_MIN/MAX) to service.constants.ts
- [ ] L3: Extract inline 'https://' magic string to WEBHOOK_REQUIRED_PROTOCOL constant
- [ ] L4: Change confirmAcknowledgement from .parse() to .safeParse() with explicit error
- [ ] L5: Add named constants for poll status literals ('open'/'closed')
