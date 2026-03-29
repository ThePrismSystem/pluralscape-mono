---
# api-0fma
title: "L10: Add composite index for delivery list ordering"
status: scrapped
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:07:51Z
parent: api-hvub
---

Delivery list ORDER BY id DESC with WHERE system_id = ? would benefit from composite index.

## Reasons for Scrapping\n\nSame as L9 — existing system_id index + PK sufficient pre-production.
