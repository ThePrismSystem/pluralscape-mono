---
# db-cwqh
title: Add LIMIT to view query helpers
status: scrapped
type: task
priority: low
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-16T06:29:46Z
parent: ps-4ioj
---

getPendingWebhookRetries and getCurrentFrontingComments view helpers have no LIMIT clause. Add reasonable limits to prevent unbounded reads.
