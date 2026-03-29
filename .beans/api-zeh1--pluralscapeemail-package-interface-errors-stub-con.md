---
# api-zeh1
title: "@pluralscape/email package — interface, errors, stub, contract tests"
status: todo
type: task
priority: high
created_at: 2026-03-29T02:45:15Z
updated_at: 2026-03-29T02:45:15Z
parent: api-7xw0
---

Create packages/email/ following the adapter pattern from @pluralscape/storage and @pluralscape/queue.

## Scope

- `EmailAdapter` interface with `send(params): Promise<EmailSendResult>` + `providerName`
- `EmailSendParams`: `to`, `subject`, `html`, `text`, optional `from`/`replyTo`
- Error types: `EmailDeliveryError`, `EmailConfigurationError`, `EmailRateLimitError`, `InvalidRecipientError`
- `StubEmailAdapter` — logs without sending (production fallback, like `StubPushProvider`)
- `InMemoryEmailAdapter` — captures sent messages for test assertions
- `runEmailAdapterContract()` contract test suite
- Package exports: `.` (interface + errors), `./testing` (memory adapter + contract runner)
- Registered in `vitest.config.ts` PACKAGES array

## Checklist

- [ ] Create `packages/email/package.json` with multi-export pattern (cf. `packages/storage/package.json`)
- [ ] Define `EmailAdapter` interface and `EmailSendParams`/`EmailSendResult` types
- [ ] Implement error types: `EmailDeliveryError`, `EmailConfigurationError`, `EmailRateLimitError`, `InvalidRecipientError`
- [ ] Implement `StubEmailAdapter` (logs only, no-op send)
- [ ] Implement `InMemoryEmailAdapter` (captures sent messages for assertions)
- [ ] Write `runEmailAdapterContract()` contract test suite (cf. `packages/storage/src/__tests__/blob-storage.contract.ts`)
- [ ] Configure package exports: `.` (interface + errors), `./testing` (memory adapter + contract)
- [ ] Register in root `vitest.config.ts` PACKAGES array
- [ ] Unit tests pass, typecheck clean

## Reference Files

- `packages/storage/src/interface.ts` — interface pattern
- `packages/storage/src/__tests__/blob-storage.contract.ts` — contract test pattern
- `packages/storage/package.json` — multi-export pattern
