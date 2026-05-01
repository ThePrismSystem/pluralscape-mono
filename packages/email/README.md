# @pluralscape/email

Platform-agnostic email sending with typed security notification templates.

## Overview

This package provides a common `EmailAdapter` interface that decouples email delivery from the
rest of the API. All email operations go through `send(params: EmailSendParams)`, which returns
a `Promise<EmailSendResult>`. Switching providers requires only swapping the adapter — no
changes to call sites.

Four adapters ship with the package. `ResendEmailAdapter` targets hosted deployments using the
Resend API. `SmtpEmailAdapter` targets self-hosted deployments via Nodemailer and supports
optional connection pooling. `StubEmailAdapter` is a no-op suitable as a production fallback
when no provider is configured. `InMemoryEmailAdapter` (available via the `./testing` entry
point) captures sent messages in memory for test assertions.

The `./templates` entry point provides six typed security notification templates:
`recovery-key-regenerated`, `new-device-login`, `password-changed`, `two-factor-changed`,
`webhook-failure-digest`, and `account-change-email`. Each template is rendered to
`{ subject, html, text }` via `renderTemplate`, keeping HTML generation separate from delivery.

This package is transport-only. Email addresses themselves are encrypted at rest on the server
via XChaCha20-Poly1305 with a server-held symmetric key; decryption and address resolution live
in the API (`resolveAccountEmail`), not here. See ADR 029 (Server-Side Encrypted Email) and
ADR 030 (Email Provider Selection) for design rationale.

## Key Exports

### Core (`@pluralscape/email`)

| Export                    | Kind      | Purpose                                                                |
| ------------------------- | --------- | ---------------------------------------------------------------------- |
| `EmailAdapter`            | interface | Common adapter contract (`providerName`, `send`)                       |
| `EmailSendParams`         | interface | Input to `send` (`to`, `subject`, `html`, `text`, `from?`, `replyTo?`) |
| `EmailSendResult`         | interface | Output of `send` (`messageId: string \| null`)                         |
| `StubEmailAdapter`        | class     | No-op adapter, safe as a production fallback                           |
| `EmailDeliveryError`      | class     | Provider rejected the message                                          |
| `EmailConfigurationError` | class     | Adapter is misconfigured (bad API key, SMTP connection failure)        |
| `EmailRateLimitError`     | class     | Provider rate-limited the request (carries `retryAfterSeconds`)        |
| `EmailValidationError`    | class     | Send params failed local validation (carries `field`, `actual`, `max`) |
| `InvalidRecipientError`   | class     | Recipient, `from`, or `replyTo` address rejected                       |
| `DEFAULT_FROM_ADDRESS`    | const     | Default sender address                                                 |
| `MAX_RECIPIENTS`          | const     | Maximum recipients per send                                            |
| `MAX_SUBJECT_LENGTH`      | const     | Maximum subject line length                                            |
| `validateSendParams`      | function  | Throws on invalid params before hitting the provider                   |

`validateSendParams` checks recipient count, subject length, and the shape of optional `from`
and `replyTo` addresses. The address check is implemented as a linear scan (not a regex) to
avoid polynomial-time backtracking on adversarial inputs (CodeQL `js/polynomial-redos`).

### Resend adapter (`@pluralscape/email/resend`)

| Export                     | Kind      | Purpose                          |
| -------------------------- | --------- | -------------------------------- |
| `ResendEmailAdapter`       | class     | Adapter backed by the Resend API |
| `ResendEmailAdapterConfig` | interface | `{ apiKey, fromAddress? }`       |

Factory methods: `ResendEmailAdapter.create(config)`, `ResendEmailAdapter.fromClient(client, fromAddress?)`.

### SMTP adapter (`@pluralscape/email/smtp`)

| Export             | Kind      | Purpose                                                  |
| ------------------ | --------- | -------------------------------------------------------- |
| `SmtpEmailAdapter` | class     | Adapter backed by Nodemailer                             |
| `SmtpConfig`       | interface | `{ host, port, secure?, auth?, pool?, maxConnections? }` |

Factory methods: `SmtpEmailAdapter.create(config, fromAddress?)`, `SmtpEmailAdapter.fromTransport(transport, fromAddress?)`.

### Templates (`@pluralscape/email/templates`)

| Export                       | Kind      | Purpose                                                                 |
| ---------------------------- | --------- | ----------------------------------------------------------------------- |
| `renderTemplate`             | function  | `renderTemplate(name, vars)` → `RenderedEmail`                          |
| `EmailTemplateMap`           | interface | Maps template name to its variable type                                 |
| `EmailTemplateName`          | type      | Union of valid template names                                           |
| `RenderedEmail`              | interface | `{ subject, html, text }`                                               |
| `RecoveryKeyRegeneratedVars` | interface | `{ timestamp, deviceInfo }`                                             |
| `NewDeviceLoginVars`         | interface | `{ timestamp, deviceInfo, ipAddress }`                                  |
| `PasswordChangedVars`        | interface | `{ timestamp }`                                                         |
| `TwoFactorChangedVars`       | interface | `{ timestamp, action }`                                                 |
| `WebhookFailureDigestVars`   | interface | `{ webhookUrl, failureCount, lastError, timeRangeStart, timeRangeEnd }` |
| `AccountChangeEmailVars`     | interface | `{ oldEmail, newEmail, timestamp, ipAddress? }`                         |

### Testing helpers (`@pluralscape/email/testing`)

| Export                    | Kind      | Purpose                                                                        |
| ------------------------- | --------- | ------------------------------------------------------------------------------ |
| `InMemoryEmailAdapter`    | class     | Captures sent messages; exposes `.sent`, `.lastSent`, `.sentCount`, `.clear()` |
| `SentEmail`               | interface | Record type stored in `.sent`                                                  |
| `runEmailAdapterContract` | function  | Shared contract test suite for custom adapters                                 |

## Usage

```typescript
import { ResendEmailAdapter } from "@pluralscape/email/resend";
import { renderTemplate } from "@pluralscape/email/templates";

// 1. Create an adapter
const adapter = ResendEmailAdapter.create({
  apiKey: process.env.RESEND_API_KEY!,
  fromAddress: "notifications@pluralscape.app",
});

// 2. Render a template
const email = renderTemplate("new-device-login", {
  timestamp: new Date().toISOString(),
  deviceInfo: "Chrome on macOS",
  ipAddress: "203.0.113.42",
});

// 3. Send
const result = await adapter.send({
  to: "user@example.com",
  subject: email.subject,
  html: email.html,
  text: email.text,
});

console.log(result.messageId); // provider-assigned ID, or null
```

For self-hosted deployments, swap in `SmtpEmailAdapter`:

```typescript
import { SmtpEmailAdapter } from "@pluralscape/email/smtp";

const adapter = SmtpEmailAdapter.create(
  { host: "mail.example.com", port: 587, secure: false, auth: { user: "u", pass: "p" } },
  "notifications@example.com",
);
```

In tests, use `InMemoryEmailAdapter` and assert on `.sent`:

```typescript
import { InMemoryEmailAdapter } from "@pluralscape/email/testing";

const adapter = new InMemoryEmailAdapter();
await adapter.send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "h" });
expect(adapter.sentCount).toBe(1);
expect(adapter.lastSent?.subject).toBe("s");
```

## Dependencies

| Package      | Purpose                                       |
| ------------ | --------------------------------------------- |
| `resend`     | Resend API SDK (used by `ResendEmailAdapter`) |
| `nodemailer` | SMTP transport (used by `SmtpEmailAdapter`)   |

## Testing

```bash
# Unit tests
pnpm vitest run --project email

# Integration tests
pnpm vitest run --project email-integration
```

`runEmailAdapterContract` (from `@pluralscape/email/testing`) is a shared suite that verifies
any custom adapter implementation satisfies the full `EmailAdapter` contract. Pass it your
adapter instance in a `describe` block.
