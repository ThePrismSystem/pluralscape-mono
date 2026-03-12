---
# db-oxge
title: Evaluate importJobs.source metadata leakage
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T08:28:12Z
parent: db-2nr7
---

source field reveals migration patterns (simply-plural, pluralkit, pluralscape). Consider if this is acceptable operational metadata. Ref: audit M15

## Summary of Changes\n\nAccepted as T3 with rationale documented in the tier map. The server must know the source format to select the correct import parser. Import jobs are transient operational records with extremely low sensitivity.
