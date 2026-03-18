---
# api-eony
title: Add route-level tests for blob endpoints
status: todo
type: task
priority: critical
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

Blob routes (upload-url, confirm, get, download-url, delete) have zero route-level tests. Service tests exist but route-level validation, auth enforcement, and error mapping are untested. Ref: audit T-1.
