---
# api-gw6c
title: email-send job type, email worker, service registry
status: todo
type: task
priority: high
created_at: 2026-03-29T02:45:57Z
updated_at: 2026-03-29T03:03:11Z
parent: api-7xw0
blocked_by:
  - api-zeh1
  - api-hvep
  - api-pdy8
---

Job type, worker, and service registry for email delivery.

## Scope

- Add `"email-send"` to `JobType` union + `JobPayloadMap` in `packages/types/src/jobs.ts`
- `processEmailJob()` in `apps/api/src/services/email-worker.ts` (mirrors `processPushNotification`)
  1. Resolve recipient email via `resolveAccountEmail()`
  2. Render template
  3. Send via registered adapter
  4. Errors propagate for queue retry
- Service registry in `apps/api/src/lib/email.ts`: `getEmailAdapter()`, `initEmailAdapter()`, `setEmailAdapterForTesting()`, `_resetEmailAdapterForTesting()`
- Env vars in `apps/api/src/env.ts`: `EMAIL_PROVIDER` (resend/smtp/stub), `RESEND_API_KEY`, `EMAIL_FROM`, SMTP vars
- Startup wiring in `apps/api/src/index.ts` — adapter selected by `EMAIL_PROVIDER`
- Unit + integration tests

## Checklist

- [ ] Add `"email-send"` to `JobType` union in `packages/types/src/jobs.ts`
- [ ] Add email-send payload to `JobPayloadMap`
- [ ] Implement service registry in `apps/api/src/lib/email.ts` (cf. `apps/api/src/lib/storage.ts`)
- [ ] Add env vars to `apps/api/src/env.ts`: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, SMTP vars
- [ ] Implement `processEmailJob()` in `apps/api/src/services/email-worker.ts`
- [ ] Wire startup adapter selection in `apps/api/src/index.ts`
- [ ] Unit tests for email worker (mocked adapter)
- [ ] Integration tests for email worker (with InMemoryEmailAdapter)
- [ ] Typecheck clean

## Reference Files

- `apps/api/src/services/push-notification-worker.ts` — worker pattern
- `apps/api/src/lib/storage.ts` — service registry pattern
- `packages/types/src/jobs.ts` — job type additions

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
