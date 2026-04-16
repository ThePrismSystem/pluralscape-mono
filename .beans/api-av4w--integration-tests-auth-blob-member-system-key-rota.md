---
# api-av4w
title: "Integration tests: auth, blob, member, system, key-rotation services"
status: completed
type: epic
priority: normal
created_at: 2026-03-24T12:30:03Z
updated_at: 2026-04-16T07:29:47Z
parent: ps-mmpz
---

Add integration tests for core API services that currently only have unit tests. Critical: auth.service (password hashing, sessions). High: blob.service (S3 I/O), member.service, system.service, key-rotation.service. Medium: group, account, recovery-key, device-transfer.

## Summary of Changes\n\nAll 10 child integration test beans completed. Created test files for: auth, member, system, blob, key-rotation, group, account, recovery-key, device-transfer, custom-front. Added ID generators to integration-setup.ts and created mock-blob-storage.ts helper.
