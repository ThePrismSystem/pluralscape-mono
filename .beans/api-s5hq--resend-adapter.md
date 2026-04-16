---
# api-s5hq
title: Resend adapter
status: completed
type: task
priority: normal
created_at: 2026-03-29T02:45:34Z
updated_at: 2026-04-16T06:36:06Z
parent: api-7xw0
blocked_by:
  - api-zeh1
---

Resend SDK adapter for @pluralscape/email.

## Scope

- `ResendEmailAdapter implements EmailAdapter` in `packages/email/src/adapters/resend/`
- Error mapper: Resend SDK errors → package error types
- `resend` SDK dependency
- Unit tests (mocked SDK), env-gated integration test
- Contract test suite passes
- Package export: `./resend`

## Checklist

- [ ] Add `resend` SDK dependency to `packages/email/package.json`
- [ ] Implement `ResendEmailAdapter` in `packages/email/src/adapters/resend/`
- [ ] Error mapper: Resend SDK errors → `EmailDeliveryError`, `EmailRateLimitError`, etc.
- [ ] Unit tests with mocked Resend SDK
- [ ] Env-gated integration test (requires `RESEND_API_KEY`)
- [ ] Contract test suite (`runEmailAdapterContract`) passes
- [ ] Configure package export: `./resend`
- [ ] Typecheck clean

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes

Implemented `ResendEmailAdapter` in `packages/email/src/adapters/resend/` with full error mapping from Resend SDK error codes to package error types. Uses `fromClient()` static factory for testability. Added `resend` SDK dependency. Package export `./resend`. 22 unit tests passing including contract suite and error mapping coverage.
