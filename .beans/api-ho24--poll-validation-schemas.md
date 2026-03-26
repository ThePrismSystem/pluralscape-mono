---
# api-ho24
title: Poll validation schemas
status: completed
type: task
priority: critical
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T23:27:29Z
parent: api-8lt2
---

packages/validation/src/poll.ts — CreatePoll, UpdatePoll, CastVote, ClosePoll schemas. Vote validation: cooperative one-vote-per-voter enforcement (voter EntityReference + optionId + isVeto + comment). Tests: unit (all schemas, edge cases: maxVotesPerMember bounds, veto without allowVeto, abstain).

## Summary of Changes\n\nCreated poll validation schemas (CreatePollBodySchema, UpdatePollBodySchema, CastVoteBodySchema, PollQuerySchema, PollVoteQuerySchema) in packages/validation/src/poll.ts with full unit test coverage. Added 8 poll audit event types to AuditEventType union and AUDIT_EVENT_TYPES array. Added 4 poll error codes (POLL_CLOSED, TOO_MANY_VOTES, ABSTAIN_NOT_ALLOWED, VETO_NOT_ALLOWED). Exported POLL_KINDS constant from @pluralscape/types.
