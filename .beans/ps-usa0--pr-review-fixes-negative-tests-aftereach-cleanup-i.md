---
# ps-usa0
title: "PR review fixes: negative tests, afterEach cleanup, index query tests"
status: completed
type: task
priority: normal
created_at: 2026-03-13T11:18:21Z
updated_at: 2026-03-13T11:26:33Z
---

Address all findings from PR review of fix/audit-005-medium-low-schema:\n- Add negative tests for checksum length != 64 (PG + SQLite)\n- Add negative tests for detail length > 2048 (PG + SQLite)\n- Add afterEach cleanup to PG blob-metadata and PG pk-bridge tests\n- Add query-pattern tests for new partial indexes\n- Create follow-up bean for Sha256Hex branded type

## Summary of Changes

Addressed all PR review findings:

1. **Negative checksum-length tests** — added to both PG and SQLite blob-metadata tests (63-char and 65-char checksums rejected)
2. **Negative detail-length tests** — added to both PG and SQLite audit-log tests (2048-char boundary + 2049-char rejection)
3. **afterEach cleanup** — added to PG blob-metadata and PG pk-bridge tests for test isolation
4. **Partial index query-pattern tests** — added for `field_bucket_visibility_bucket_id_idx`, `webhook_deliveries_system_retry_idx`, and `check_in_records_system_pending_idx` in both PG and SQLite
5. **Follow-up bean** — created `types-aqmu` for Sha256Hex branded type
