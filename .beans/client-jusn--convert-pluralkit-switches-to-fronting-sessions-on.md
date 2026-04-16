---
# client-jusn
title: Convert PluralKit switches to fronting sessions on import
status: completed
type: task
priority: normal
created_at: 2026-03-21T22:46:27Z
updated_at: 2026-04-16T07:13:20Z
parent: client-f61z
---

PluralKit models fronting as discrete switch events (point-in-time snapshots of who is fronting). Pluralscape uses duration-based fronting sessions instead. The PK import pipeline must convert PK switch records into overlapping fronting sessions with start/end times.

## Summary of Changes\n\nCompleted during beans audit cleanup (2026-04-16). PK switch-to-session conversion handled in import pipeline.
