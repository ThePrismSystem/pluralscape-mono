---
# db-vnfk
title: Fix member_photos.sortOrder nullable mismatch
status: completed
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T21:24:17Z
parent: db-gwpb
---

nullable in DB but non-nullable in ServerMemberPhoto type. Add .notNull(). Ref: audit M22

## Summary of Changes\n\nAlready resolved. `sortOrder` is `.notNull().default(0)` in both dialects (`pg/members.ts:43`, `sqlite/members.ts:39`).
