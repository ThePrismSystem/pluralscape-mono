---
# api-ho24
title: Poll validation schemas
status: todo
type: task
priority: critical
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T05:59:20Z
parent: api-8lt2
---

packages/validation/src/poll.ts — CreatePoll, UpdatePoll, CastVote, ClosePoll schemas. Vote validation: cooperative one-vote-per-voter enforcement (voter EntityReference + optionId + isVeto + comment). Tests: unit (all schemas, edge cases: maxVotesPerMember bounds, veto without allowVeto, abstain).
