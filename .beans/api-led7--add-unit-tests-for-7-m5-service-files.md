---
# api-led7
title: Add unit tests for 7 M5 service files
status: completed
type: task
priority: high
created_at: 2026-03-26T07:42:27Z
updated_at: 2026-03-26T10:45:30Z
parent: ps-106o
---

None of the 7 M5 service files have dedicated unit tests. Pure logic branches (result mappers, validation rules, error differentiation) are only tested through PGlite integration tests.

## Fix

Create unit tests with mocked DB for each service file, covering logic branches, mapper transformations, and error discrimination.

## Tasks

- [ ] channel.service.test.ts
- [ ] message.service.test.ts
- [ ] board-message.service.test.ts
- [ ] note.service.test.ts
- [ ] poll.service.test.ts
- [ ] poll-vote.service.test.ts
- [ ] acknowledgement.service.test.ts

\n\n**Note**: Deferred to a separate PR/commit since it's a large body of work (7 new test files). The current remediation PR focuses on the code changes.

## Summary of Changes\n\nCreated 7 unit test files covering 155 tests for all M5 service files. Also fixed webhook-config.service.test.ts to mock the validated env module.
