---
# api-54b9
title: "M7 audit remediation — PR #319 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:31:32Z
updated_at: 2026-03-29T09:31:52Z
---

Address all 12 findings (2 critical, 4 important, 6 suggestions) from the PR #319 multi-agent code review of the webhook system M7 audit.

## Summary of Changes

All 12 findings from the PR #319 multi-agent code review have been addressed:

### Critical

1. **Decryption catch block** — Added try/catch around `decryptWebhookPayload` in delivery worker. On failure, logs warning, marks delivery as failed, and returns. Key is still memzero'd in finally block.
2. **SSRF protection for testWebhookConfig** — Added DNS resolution and IP pinning via `resolveAndValidateUrl`/`buildIpPinnedFetchArgs` before fetch. Returns `success: false` with SSRF error message on validation failure.

### Important

3. **Quota guard in restore path** — Added `onRestore` hook to `WEBHOOK_CONFIG_LIFECYCLE` that checks active config count inside the restore transaction. Uses `> MAX` since the restored config is already counted.
4. **Unit tests for getWebhookPayloadEncryptionKey** — Added 3 tests: null when env var unset, valid AeadKey on valid hex, throws on wrong length.
5. **Dispatcher encryption path tests** — Added 2 tests: encryptedData stored when key configured, memzero called after dispatch.
6. **Delivery worker decrypt path test** — Added 2 tests: decryption failure marks as failed, successful decryption sends payload via fetch.

### Suggestions

7. **Extract common delivery fields** — Refactored dispatcher to use shared `base` object with spread for encrypted/plaintext branches.
8. **429 for quota errors** — Changed `HTTP_BAD_REQUEST` to `HTTP_TOO_MANY_REQUESTS` for QUOTA_EXCEEDED errors in both create and restore.
9. **CHECK constraint** — Added `webhook_deliveries_payload_check` requiring at least one of `encryptedData`/`payloadData` to be NOT NULL. Updated PG and SQLite schemas, generated migration.
10. **Branded IDs** — Added `WebhookDeliveryId`, `WebhookId`, `SystemId`, `WebhookEventType` branded types to `findPendingDeliveries` return type.
11. **TLS/SNI documentation** — Expanded `buildIpPinnedFetchArgs` JSDoc with SNI caveat and defense-in-depth note.
12. **Initialize deletedCount** — Changed `let deletedCount: number` to `let deletedCount = 0`.
