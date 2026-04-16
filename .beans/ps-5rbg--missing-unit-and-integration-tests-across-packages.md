---
# ps-5rbg
title: Missing unit and integration tests across packages
status: todo
type: task
priority: low
created_at: 2026-04-16T06:58:59Z
updated_at: 2026-04-16T06:58:59Z
parent: ps-0enb
---

Low-severity testing gap findings from comprehensive audit, spanning multiple packages.

## Findings

- [ ] [DATA-TC-L1] crdt-query-bridge.test.ts no test for undefined document
- [ ] [DATA-TC-L2] No tests cover failed decryption propagating through decryptMemberPage
- [ ] [EMAIL-TC-L1] No account-change-email template or E2E test
- [ ] [QUEUE-TC-L1] No test for Redis data corruption
- [ ] [STORAGE-TC-L1] No test for presigned URL write-once bypass
