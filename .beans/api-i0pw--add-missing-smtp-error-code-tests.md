---
# api-i0pw
title: Add missing SMTP error code tests
status: completed
type: task
priority: normal
created_at: 2026-03-29T07:12:47Z
updated_at: 2026-03-29T12:48:12Z
parent: api-kjyg
---

smtp-adapter.test.ts omits ECONNRESET and ETLS connection error codes. Response code tests skip 551, 552, 554 (recipient errors) and 450, 451 (rate limit). Add coverage for all mapped codes.
