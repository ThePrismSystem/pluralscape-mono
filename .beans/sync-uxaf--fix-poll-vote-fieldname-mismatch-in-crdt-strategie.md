---
# sync-uxaf
title: Fix poll-vote fieldName mismatch in CRDT strategies
status: todo
type: bug
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-03-24T09:25:31Z
parent: ps-4ioj
---

Strategy registry says fieldName 'pollVotes' but ChatDocument uses 'votes'. Breaks dynamic field lookup for poll votes.
