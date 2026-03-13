---
# db-rlqw
title: Confirm which junction tables need EntityType entries for sync
status: completed
type: task
priority: low
created_at: 2026-03-13T05:00:31Z
updated_at: 2026-03-13T06:40:10Z
parent: db-hcgk
---

Confirmed: junction tables (field_bucket_visibility, friend_bucket_assignments, nomenclature_settings, safe_mode_content, group_memberships, subsystem_memberships, side_system_memberships, layer_memberships) intentionally omitted from EntityType. Junction tables represent relationships, not independent entities — they don't need audit/sync tracking.
