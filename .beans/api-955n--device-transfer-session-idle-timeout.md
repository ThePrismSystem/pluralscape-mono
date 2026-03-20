---
# api-955n
title: Device transfer session idle timeout
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T10:32:47Z
parent: crypto-og5h
---

M13: Add an idle timeout for device transfer sessions to prevent stale transfers from remaining valid.

## Acceptance Criteria

- Transfer sessions with no activity (no complete attempt) past idle threshold marked as expired
- Idle threshold configurable in constants file (default: 5 minutes, matching transfer expiry)
- Idle detection runs as part of the transfer session cleanup job (api-8gyw), not a separate job
- Expired-by-idle sessions return 410 Gone on complete attempt
- Does not affect transfers that have already been completed or approved
- Integration test: create transfer, wait past idle threshold, attempt complete → 410

## Summary of Changes

- Handled by the `expiresAt` column and the `completeTransfer` WHERE clause
- The complete endpoint filters by `gt(deviceTransferRequests.expiresAt, currentTime)` ensuring expired transfers are rejected
- Cleanup job (api-8gyw) handles bulk expiration of stale pending transfers
