---
# db-19ae
title: Validate switches.memberIds against system member IDs at app layer
status: todo
type: bug
priority: normal
created_at: 2026-03-12T01:39:44Z
updated_at: 2026-03-12T01:39:44Z
---

switches.memberIds is a JSONB array that cannot have FK constraints. Cross-system member IDs could be inserted with no server-side validation. Need application-layer validation to verify member IDs belong to the same system.
