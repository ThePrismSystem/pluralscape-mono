---
# api-kglj
title: "L3: Add one-time-read mechanism for webhook secret response"
status: scrapped
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:07:49Z
parent: api-hvub
---

Webhook secret returned in HTTP response on create/rotate with no one-time-read mechanism.

## Reasons for Scrapping\n\nStandard webhook API pattern (GitHub/Stripe style). Adding token-based one-time retrieval is high complexity for marginal gain.
