---
# api-sj5f
title: 'H5: Partial index for pending delivery polling'
status: completed
type: task
created_at: 2026-03-29T09:52:35Z
updated_at: 2026-03-29T09:52:35Z
parent: api-hvub
---

findPendingDeliveries OR pattern prevented efficient index use. Added partial index on (next_retry_at) WHERE status = pending. Fixed in PR #319.
