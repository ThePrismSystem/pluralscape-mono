---
# ps-wt1t
title: Add versioned() to notificationConfigs and pollVotes tables
status: todo
type: bug
priority: normal
created_at: 2026-04-06T00:53:09Z
updated_at: 2026-04-06T00:53:09Z
parent: ps-y621
---

notificationConfigs uses archivable() but not versioned(). No server-side protection against concurrent writes — silent data loss in multi-device scenarios. pollVotes also lacks versioned() and timestamps(), diverging from every other mutable entity.

Fix: add versioned() to both tables. Regenerate migrations + RLS.

Files: packages/db/src/schema/pg/notifications.ts, packages/db/src/schema/pg/communication.ts
Audit ref: Pass 8 MEDIUM
