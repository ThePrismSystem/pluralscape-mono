---
# client-jusn
title: Convert PluralKit switches to fronting sessions on import
status: todo
type: task
created_at: 2026-03-21T22:46:27Z
updated_at: 2026-03-21T22:46:27Z
parent: client-f61z
---

PluralKit models fronting as discrete switch events (point-in-time snapshots of who is fronting). Pluralscape uses duration-based fronting sessions instead. The PK import pipeline must convert PK switch records into overlapping fronting sessions with start/end times.
