---
# ps-uvgu
title: Fix fronting session materializer notNull constraint
status: todo
type: bug
priority: normal
created_at: 2026-04-06T00:53:09Z
updated_at: 2026-04-06T00:53:09Z
parent: ps-y621
---

FrontingSessionBase.memberId is typed as MemberId | null (nullable for custom fronts), but the materializer entity-registry marks member_id as notNull: true. Custom front sessions with no member would fail to materialize locally.

Fix: change notNull to false in entity-registry.ts for fronting-session member_id.

Audit ref: Pass 8 LOW
