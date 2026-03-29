---
# api-w1ia
title: SMTP adapter (Nodemailer)
status: todo
type: task
priority: normal
created_at: 2026-03-29T02:45:38Z
updated_at: 2026-03-29T03:03:11Z
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
