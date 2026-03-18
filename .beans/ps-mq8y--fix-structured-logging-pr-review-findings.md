---
# ps-mq8y
title: Fix structured logging PR review findings
status: completed
type: task
priority: normal
created_at: 2026-03-18T21:53:46Z
updated_at: 2026-03-18T22:06:34Z
parent: api-mzn0
---

Address all 3 important issues and 9 suggestions from PR review of feat/structured-logging

## Summary of Changes

- Replaced hand-rolled `PinoInstance` interface with `pino.Logger` from pino types
- Added `APP_LOGGER_BRAND` symbol for safe type narrowing in `getContextLogger`
- Deduplicated `wrapPino` by extracting `wrapLevel` helper
- Narrowed `getContextLogger` param from `get(key: string)` to `get(key: "log")`
- Created shared `createMockLogger()` helper in test helpers
- Replaced `error.message` string logging with pino `err` key for stack trace preservation at all 11 call sites
- Added 4xx logging in error handler (info for 401/403, debug for other client errors)
- Added `requestId` and `err` context to ZodError log
- Added `getContextLogger` unit tests (4 cases + brand check)
- Added branded AppLogger attachment test to request-id middleware
- Fixed blob-s3-cleanup test to use logger mock instead of console.warn spy
- Updated all test assertions to match new error serialization pattern
- Updated service tests to use shared mock logger helper
- Added log content assertions for audit write failure and 4xx logging
