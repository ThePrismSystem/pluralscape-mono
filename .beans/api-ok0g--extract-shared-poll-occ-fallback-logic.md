---
# api-ok0g
title: Extract shared poll OCC fallback logic
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T10:23:13Z
parent: ps-106o
---

updatePoll and closePoll contain nearly identical 15-line fallback blocks for distinguishing POLL_CLOSED vs NOT_FOUND vs CONFLICT.

## File

- poll.service.ts:244-356

## Fix

Extract a shared assertPollUpdated helper within the file.

## Tasks

- [ ] Extract assertPollUpdated helper
- [ ] Refactor updatePoll and closePoll to use it

## Summary of Changes\n\nExtracted assertPollUpdated helper within poll.service.ts. Both updatePoll and closePoll now use it. Fixed bug where closePoll threw NOT_FOUND instead of CONFLICT for version mismatch.
