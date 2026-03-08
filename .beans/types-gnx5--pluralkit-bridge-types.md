---
# types-gnx5
title: PluralKit bridge types
status: todo
type: task
created_at: 2026-03-08T18:49:48Z
updated_at: 2026-03-08T18:49:48Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Types for PluralKit bridge integration: PKBridgeConfig (systemId, pkToken, syncDirection, lastSyncAt, enabled), PKSyncState (lastSyncAt, entityMappings, errorLog, syncStatus), PKEntityMapping (psEntityId, pkEntityId, entityType, lastSyncedVersion). Bridge runs client-side per features.md section 9.
