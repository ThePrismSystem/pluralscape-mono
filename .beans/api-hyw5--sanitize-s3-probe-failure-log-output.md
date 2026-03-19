---
# api-hyw5
title: Sanitize S3 probe failure log output
status: todo
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-19T11:39:43Z
parent: api-765x
---

L5: Ensure S3 probe failure logs don't leak credentials or internal URLs.

## Acceptance Criteria

- S3 probe failure logs sanitized: no access keys, secret keys, or internal endpoint URLs
- Log output contains: bucket name (if non-sensitive), error type, error message
- Sensitive fields redacted or omitted entirely
- Unit test: simulate S3 probe failure, verify log output contains no sensitive values
