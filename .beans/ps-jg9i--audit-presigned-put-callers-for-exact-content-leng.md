---
# ps-jg9i
title: Audit presigned PUT callers for exact Content-Length
status: todo
type: task
priority: low
created_at: 2026-04-17T17:49:15Z
updated_at: 2026-04-17T17:49:15Z
---

Follow-up from PR #464 ps-cpxh Domain 7. The S3 signing fix added \`content-length\` to signableHeaders, which makes the byte count an exact-match constraint enforced by SigV4.

Audit every caller of \`requestUploadUrl\` / \`S3BlobStorageAdapter.createPresignedUpload\` to confirm:

- Does the caller pass the EXACT byte count being uploaded?
- Or does it pass an estimate (e.g. pre-encryption size when the uploaded body is ciphertext)?

If any caller passes an estimate, upload will 403 SignatureDoesNotMatch post-fix. Either:

1. Update caller to compute exact ciphertext length before calling the adapter, OR
2. Add caller documentation warning that sizeBytes must be the exact on-the-wire byte count

## Todos

- [ ] Grep for all callers of \`createPresignedUpload\` / \`requestUploadUrl\`
- [ ] For each, trace whether the \`sizeBytes\` arg is exact or estimated
- [ ] Fix any estimators to compute exact byte count
- [ ] Document the exact-size contract in the adapter JSDoc

## Context

E2E happy-path passes today (499/499), so callers in use are correct. This is a latent risk for any path not yet covered by E2E.
