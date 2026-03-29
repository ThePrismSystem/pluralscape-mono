---
# api-5cad
title: "L6: Deduplicate pagination parsing between webhook routes"
status: scrapped
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:07:50Z
parent: api-hvub
---

Pagination parsing duplicated between webhook-configs and webhook-deliveries list routes.

## Reasons for Scrapping\n\nThis is the codebase-wide list route pattern, not webhook-specific. Changing only webhooks would be inconsistent.
