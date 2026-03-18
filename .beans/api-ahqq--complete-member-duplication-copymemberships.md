---
# api-ahqq
title: Complete member duplication (copyMemberships)
status: completed
type: bug
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:57:40Z
parent: api-i2pw
---

DuplicateMemberBodySchema accepts copyMemberships:boolean but service only copies photos and field values - membership copying not implemented. Also missing discovery lifecycle event. Ref: audit S-7.

## Summary of Changes

Added `copyMemberships` support to `duplicateMember`. When enabled, queries source member's `groupMemberships` and batch inserts them for the new member. Audit detail includes membership count.
