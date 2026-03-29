# ADR 030: Email Provider Selection

## Status

Accepted

## Context

Pluralscape needs transactional email for security-critical notifications: recovery key alerts, new device login, password changes, 2FA changes, and webhook failure digests. As a privacy-first application that supports both hosted and self-hosted deployments, the email provider selection must avoid cloud lock-in while maintaining good deliverability and developer ergonomics.

## Decision

Support two email providers through a shared `EmailAdapter` interface (`packages/email/src/interface.ts`), plus a stub fallback:

- **Resend** (`resend@^4.1.2`) — Modern API-first email service with a minimal SDK footprint. Suitable for hosted Pluralscape deployments where managed deliverability and DNS/DKIM setup are preferred over operating SMTP infrastructure.

- **Nodemailer** (`nodemailer@^8.0.4`) — Battle-tested SMTP library that works with any SMTP server (Postfix, Mailgun SMTP, Amazon SES SMTP relay, etc.). Critical for self-hosted deployments where operators choose their own mail infrastructure.

- **StubAdapter** — No-op implementation that silently discards emails. Used in development, testing, and deployments that intentionally opt out of email notifications.

Each adapter lives in its own sub-path export (`@pluralscape/email/resend`, `@pluralscape/email/smtp`) so consumers only import — and bundle — the adapter they configure.

### Rationale

The dual-adapter approach directly serves both deployment models. Hosted deployments benefit from Resend's simple API and built-in deliverability tooling. Self-hosted operators must not be locked into any specific email vendor; Nodemailer's SMTP support lets them use whatever mail server they already run. The `EmailAdapter` interface keeps business logic (templates, send triggers) decoupled from transport, so adding future providers requires only a new adapter implementation.

## Alternatives Considered

| Alternative     | Reason rejected                                                                          |
| --------------- | ---------------------------------------------------------------------------------------- |
| SendGrid only   | Heavier SDK, complex pricing tiers, no self-hosted SMTP path                             |
| Postmark only   | Strong deliverability but no self-hosted option; smaller ecosystem                       |
| AWS SES only    | Cloud lock-in to AWS; hostile to self-hosted deployments                                 |
| Single provider | Violates the self-hosted deployment requirement — operators must control their mail path |

## Consequences

- **Two adapter implementations to maintain.** Contract tests against `EmailAdapter` ensure behavioral parity across adapters.
- **Configuration surface increases.** The API must accept provider selection and provider-specific config (API key for Resend, SMTP host/port/auth for Nodemailer).
- **New providers are additive.** Any future provider (e.g., Postmark, Mailgun API) requires only a new adapter module and sub-path export — no changes to templates or send logic.
- **StubAdapter prevents hard failures** in environments without email configuration, keeping the development loop fast and self-hosted setups functional even before mail is configured.
