---
# ps-5rbg
title: Missing unit and integration tests across packages
status: completed
type: task
priority: low
created_at: 2026-04-16T06:58:59Z
updated_at: 2026-04-17T09:19:13Z
parent: ps-0enb
---

Low-severity testing gap findings from comprehensive audit, spanning multiple packages.

## Findings

- [x] [DATA-TC-L1] crdt-query-bridge.test.ts no test for undefined document
- [x] [DATA-TC-L2] No tests cover failed decryption propagating through decryptMemberPage
- [x] [EMAIL-TC-L1] No account-change-email template or E2E test
- [x] [QUEUE-TC-L1] No test for Redis data corruption
- [x] [STORAGE-TC-L1] No test for presigned URL write-once bypass

## Summary of Changes

- **DATA-TC-L1**: Added test for `crdt-query-bridge` undefined-document case.
- **DATA-TC-L2**: Added tests verifying `decryptMemberPage` propagates
  decryption failures in three scenarios (all-corrupt page, mixed page,
  missing required fields).
- **EMAIL-TC-L1**: Created `account-change-email` template and render unit
  tests (basic, XSS, optional IP). Wired into `changeEmail` service via a
  new `recipientOverride` field on `email-send` job payload — required
  because the worker resolves the account's current email, and while the
  current bug happens to send to OLD email today, a future fix that
  updates `accounts.encryptedEmail` would break this without the override.
  Latent bug identified: `changeEmail` doesn't update `encryptedEmail` —
  follow-up recommended.
- **QUEUE-TC-L1**: Added BullMQ Redis data corruption integration tests.
  New `QueueCorruptionError` typed error class wraps JSON parse failures
  and schema mismatches in `retry`, `cancel`, and `getJob` cancelled-store
  paths and the main BullMQ `getJob` path.
- **STORAGE-TC-L1**: Added presigned-URL write-once integration test against
  MinIO. Required migrating S3 adapter from `createPresignedPost` to
  `getSignedUrl(PutObjectCommand, ...)` with `IfNoneMatch: "*"` in
  `signableHeaders`, because POST policies cannot enforce the write-once
  precondition. **API shape change**: `PresignedUrlResult.fields` is no
  longer populated. In-repo callers (mobile `use-blobs.ts`, `trpc-persister-api.ts`,
  api-e2e) updated; no external package consumers in this repo.
  `@aws-sdk/s3-presigned-post` is now a dead dependency (left in place for
  a future follow-up PR).
