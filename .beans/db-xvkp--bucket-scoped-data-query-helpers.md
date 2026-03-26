---
# db-xvkp
title: Bucket-scoped data query helpers
status: todo
type: feature
created_at: 2026-03-26T16:05:10Z
updated_at: 2026-03-26T16:05:10Z
parent: client-napj
blocked_by:
  - client-napj
---

Implement getFriendVisibleMembers, getFriendVisibleCustomFronts, getFriendActiveFronters, getFriendVisibleFieldDefinitions, getFriendVisibleFieldValues, getFriendVisibleGroups. All read-only. Server returns encrypted blobs, never decrypts. Bucket intersection determines which records to return. Files: packages/db/src/views/friend-data.pg.ts (new). Tests: integration with seeded data; fail-closed (no tags = invisible), intersection correctness.
