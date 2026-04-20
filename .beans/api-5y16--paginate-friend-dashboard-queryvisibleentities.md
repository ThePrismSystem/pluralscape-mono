---
# api-5y16
title: Paginate friend dashboard queryVisibleEntities
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [P2] from audit 2026-04-20 (correctness at scale). apps/api/src/services/friend-dashboard.service.ts:149. Hard-capped at MAX_PAGE_LIMIT=100; systems with more members/custom-fronts/structure-entities silently truncate friend visibility. Fix: system-wide quota cap or dedicated pagination flow.
