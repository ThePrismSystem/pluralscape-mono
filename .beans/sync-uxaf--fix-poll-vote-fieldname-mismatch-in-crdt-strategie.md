---
# sync-uxaf
title: Fix poll-vote fieldName mismatch in CRDT strategies
status: completed
type: bug
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-04T21:51:10Z
parent: ps-4ioj
---

Strategy registry says fieldName 'pollVotes' but ChatDocument uses 'votes'. Breaks dynamic field lookup for poll votes.

## Summary of Changes

Poll-vote fieldName mismatch was already fixed in the codebase. The CRDT strategy correctly maps "poll-vote" → fieldName "votes", matching the schema definition in packages/sync/src/schemas/chat.ts.
