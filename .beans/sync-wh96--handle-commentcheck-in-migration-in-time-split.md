---
# sync-wh96
title: Handle comment/check-in migration in time-split
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-14T14:53:47Z
parent: ps-4ioj
---

Time-split migrates fronting sessions but does not migrate associated comments or check-in records, creating cross-document references.

## Summary of Changes\n\nModified time-split to migrate comments with active fronting sessions. Built Set of active session IDs, filter comments by frontingSessionId membership. Check-in records are timer-scoped (not session-scoped) so correctly excluded. Added 4 tests.
