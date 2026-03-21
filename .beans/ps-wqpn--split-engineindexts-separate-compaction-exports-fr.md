---
# ps-wqpn
title: "Split engine/index.ts: separate compaction exports from SyncEngine"
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:08:32Z
parent: ps-i3xl
---

Mixed concerns in barrel

## Summary of Changes\n\nSplit engine/index.ts: SyncEngine + SyncEngineConfig stay in engine/index.ts. Compaction exports moved to new engine/compaction.ts re-export file. Root index.ts updated to import compaction from the new path.
