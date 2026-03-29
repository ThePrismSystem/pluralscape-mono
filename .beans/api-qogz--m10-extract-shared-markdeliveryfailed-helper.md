---
# api-qogz
title: 'M10: Extract shared markDeliveryFailed helper'
status: todo
type: task
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T09:52:48Z
parent: api-hvub
---

webhook-delivery-worker.ts lines 100-107, 114-118, 131-135 — Three nearly identical db.update().set({status:failed}) blocks.
