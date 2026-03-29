---
# api-njff
title: Add missing list endpoint filters and pagination
status: todo
type: task
priority: high
created_at: 2026-03-29T21:31:41Z
updated_at: 2026-03-29T21:31:41Z
parent: api-e7gt
---

Several list endpoints are missing expected filters:

- Relationship list: no type filter (only memberId) — Domain 4, gap 3
- Group list: no includeArchived filter — Domain 5, gap 1
- Friend code list: no cursor pagination — Domain 10, gap 3
- Webhook delivery list: no date-range filter — Domain 15, gap 5
- Bucket list: no status-only filter for archived — Domain 11, gap 3

Audit ref: Domains 4/5/10/11/15
