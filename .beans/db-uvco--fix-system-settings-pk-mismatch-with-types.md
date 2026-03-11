---
# db-uvco
title: Fix system_settings PK mismatch with types
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

system_settings uses systemId as PK but types expect separate SystemSettingsId. Ref: audit M18
