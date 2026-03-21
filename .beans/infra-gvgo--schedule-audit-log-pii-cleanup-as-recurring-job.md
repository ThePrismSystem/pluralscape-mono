---
# infra-gvgo
title: Schedule audit log PII cleanup as recurring job
status: todo
type: task
priority: normal
created_at: 2026-03-15T21:56:02Z
updated_at: 2026-03-21T10:10:57Z
parent: ps-9u4w
---

Finding 11 from STRIDE/OWASP audit. Audit logs may accumulate PII over time. Implement a scheduled background job to scrub/archive old audit entries with personal data.
