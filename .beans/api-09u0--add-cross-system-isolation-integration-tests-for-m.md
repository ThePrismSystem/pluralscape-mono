---
# api-09u0
title: Add cross-system isolation integration tests for M5
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T10:30:33Z
parent: ps-106o
---

None of the M5 integration tests create a second system and verify that data from one system is inaccessible to another. Only covered at E2E level.

## Fix

Add at least one cross-system isolation test per M5 service integration file.

## Tasks

- [ ] channel.service.integration.test.ts
- [ ] message.service.integration.test.ts
- [ ] board-message.service.integration.test.ts
- [ ] note.service.integration.test.ts
- [ ] poll.service.integration.test.ts
- [ ] poll-vote.service.integration.test.ts
- [ ] acknowledgement.service.integration.test.ts

## Summary of Changes\n\nAdded cross-system isolation describe blocks with 2 tests each to all 7 M5 integration test files, verifying get returns NOT_FOUND and list returns empty for a second system.
