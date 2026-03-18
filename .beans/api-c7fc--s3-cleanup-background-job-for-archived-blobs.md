---
# api-c7fc
title: S3 cleanup background job for archived blobs
status: completed
type: task
priority: deferred
created_at: 2026-03-18T12:50:14Z
updated_at: 2026-03-18T14:46:27Z
---

B-3 from audit 012: When blobs are archived, the S3 objects are not cleaned up. Need a background job that periodically removes S3 objects for archived/deleted blobs. Defer to M3.
