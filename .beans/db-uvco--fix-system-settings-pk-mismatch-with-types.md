---
# db-uvco
title: Fix system_settings PK mismatch with types
status: scrapped
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T21:24:18Z
parent: db-gwpb
---

system_settings uses systemId as PK but types expect separate SystemSettingsId. Ref: audit M18

## Reasons for Scrapping\n\nNot a bug. The table has a proper `id` PK plus a unique FK on `systemId`, matching the `SystemSettingsId` type. The 1:1 relationship is correctly enforced.
