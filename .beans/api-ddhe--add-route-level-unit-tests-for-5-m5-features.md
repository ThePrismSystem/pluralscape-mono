---
# api-ddhe
title: Add route-level unit tests for 5 M5 features
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T10:46:12Z
parent: ps-106o
---

Only board-messages has route-level unit tests. Channels, messages, notes, polls, and acknowledgements have none.

## Fix

Create route unit tests following the board-messages pattern (testing HTTP status codes, parameter forwarding, error propagation).

## Tasks

- [ ] channels route unit tests
- [ ] messages route unit tests
- [ ] notes route unit tests
- [ ] polls route unit tests
- [ ] acknowledgements route unit tests

## Summary of Changes\n\nCreated 5 route-level unit test files for channels, messages, notes, polls, and acknowledgements following the board-messages/crud.test.ts pattern. Total 113 new route tests.
