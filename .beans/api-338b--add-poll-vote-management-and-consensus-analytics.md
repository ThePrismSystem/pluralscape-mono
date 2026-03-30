---
# api-338b
title: Add poll vote management and consensus analytics
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:42Z
updated_at: 2026-03-30T00:38:29Z
parent: api-e7gt
---

Poll service gaps:

1. No update vote endpoint — only castVote + listVotes in service
2. No delete vote endpoint — no archive/restore for votes either
3. No consensus analytics / results summary endpoint

Audit ref: Domain 9, gaps 1-3

## Summary of Changes\n\n- Added updatePollVote(), deletePollVote() (soft-archive), getPollResults()\n- Created update-vote, delete-vote, results route handlers\n- Added UpdatePollVoteBodySchema\n- 23 unit tests
