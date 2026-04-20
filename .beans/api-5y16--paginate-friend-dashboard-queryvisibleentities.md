---
# api-5y16
title: Paginate friend dashboard queryVisibleEntities
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T12:02:37Z
parent: api-v8zu
---

Finding [P2] from audit 2026-04-20 (correctness at scale). apps/api/src/services/friend-dashboard.service.ts:149. Hard-capped at MAX_PAGE_LIMIT=100; systems with more members/custom-fronts/structure-entities silently truncate friend visibility. Fix: system-wide quota cap or dedicated pagination flow.

## Summary of Changes

Removed the hard MAX_PAGE_LIMIT=100 truncation from queryVisibleEntities in the friend dashboard service. Each wrapper now passes its entity-type-specific system-wide quota (MAX_MEMBERS_PER_SYSTEM=5000, MAX_CUSTOM_FRONTS_PER_SYSTEM=200, MAX_INNERWORLD_ENTITIES_PER_SYSTEM=500) as the LIMIT. Silent truncation is no longer possible within realistic system sizes. Clients that need true paginated access over very large result sets already have getFriendExportPage (cursor-based). Added integration regression test asserting 120 visible members are returned in full.
