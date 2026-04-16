---
# api-w1ia
title: SMTP adapter (Nodemailer)
status: completed
type: task
priority: normal
created_at: 2026-03-29T02:45:38Z
updated_at: 2026-04-16T06:36:07Z
parent: api-7xw0
blocked_by:
  - api-zeh1
  - api-s5hq
---

SMTP adapter using Nodemailer for @pluralscape/email. Ships alongside Resend to validate the interface with a second adapter.

## Scope

- `SmtpEmailAdapter implements EmailAdapter` in `packages/email/src/adapters/smtp/`
- `SmtpConfig`: host, port, secure, auth, pool settings
- Error mapper: Nodemailer/SMTP errors → package error types
- `nodemailer` + `@types/nodemailer` dependencies
- Unit tests (mocked transport), env-gated integration test
- Contract test suite passes
- Package export: `./smtp`

## Checklist

- [ ] Add `nodemailer` + `@types/nodemailer` dependencies to `packages/email/package.json`
- [ ] Implement `SmtpEmailAdapter` in `packages/email/src/adapters/smtp/`
- [ ] Define `SmtpConfig` type (host, port, secure, auth, pool settings)
- [ ] Error mapper: Nodemailer/SMTP errors → `EmailDeliveryError`, `EmailConfigurationError`, etc.
- [ ] Unit tests with mocked Nodemailer transport
- [ ] Env-gated integration test (requires SMTP server)
- [ ] Contract test suite (`runEmailAdapterContract`) passes
- [ ] Configure package export: `./smtp`
- [ ] Typecheck clean

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes

Implemented `SmtpEmailAdapter` in `packages/email/src/adapters/smtp/` with `SmtpConfig` type (host, port, secure, auth, pool, maxConnections). Maps SMTP error codes and Nodemailer error codes to package error types. Uses `SendMailFn` abstraction for type-safe DI in tests. Added `nodemailer` + `@types/nodemailer` dependencies. Package export `./smtp`. 22 unit tests passing including contract suite and comprehensive error mapping.
