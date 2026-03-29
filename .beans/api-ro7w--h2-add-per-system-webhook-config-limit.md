---
# api-ro7w
title: "H2: Add per-system webhook config limit"
status: completed
type: task
created_at: 2026-03-29T09:52:35Z
updated_at: 2026-03-29T09:52:35Z
parent: api-hvub
---

createWebhookConfig had no COUNT(\*) check. Added limit of 25 with row-lock + count pattern. Fixed in PR #319.
