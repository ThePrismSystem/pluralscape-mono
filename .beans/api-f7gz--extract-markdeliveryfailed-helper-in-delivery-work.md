---
# api-f7gz
title: Extract markDeliveryFailed helper in delivery worker
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:12:46Z
parent: api-kjyg
---

webhook-delivery-worker.ts has three nearly identical db.update().set({status:'failed'}) blocks at lines 100-107, 114-118, 131-135. Extract a markDeliveryFailed(db, deliveryId, httpStatus?) helper.
