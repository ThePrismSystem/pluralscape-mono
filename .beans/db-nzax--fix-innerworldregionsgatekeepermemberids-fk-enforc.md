---
# db-nzax
title: Fix innerworldRegions.gatekeeperMemberIds FK enforcement
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

Member IDs in JSONB array cannot be FK-constrained. Deleted/archived member causes fail-open access control. Consider junction table or application-layer cleanup triggers. Ref: audit H17
