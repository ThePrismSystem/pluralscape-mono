---
# ps-bx4j
title: Remove unused db export paths
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:04:04Z
parent: ps-i3xl
---

./helpers, ./columns/pg, ./columns/sqlite from packages/db/package.json

## Summary of Changes\n\nRemoved ./columns/pg, ./columns/sqlite, and ./helpers from @pluralscape/db package.json exports map. No consumer imports these paths.
