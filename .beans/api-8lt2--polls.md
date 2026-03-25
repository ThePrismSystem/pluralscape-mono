---
# api-8lt2
title: Polls
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-25T05:59:18Z
parent: ps-53up
---

Creation, voting, cooperative one-vote-per-member enforcement

## Scope

Multiple-choice polls with cooperative consensus analytics. Poll options are T1 encrypted (stored in poll encryptedData, no server-side poll_options table). Server only sees optionId in votes. Voters are polymorphic EntityReference<"member" | "structure-entity">. Supports standard and custom poll kinds, optional end date, abstain, and veto. Vote uniqueness enforced cooperatively per voter entity.

CRDT: polls + pollOptions + votes already modeled in ChatDocument schema. Votes are append-only (immutable once cast).

## Acceptance Criteria

- Poll CRUD with status transitions (open → closed), closedAt/endsAt management
- Vote casting with cooperative enforcement: maxVotesPerMember, polymorphic voter entity uniqueness
- Abstain (optionId=null) and veto (isVeto=true, requires allowVeto) support
- Delete poll returns 409 if has votes
- CRDT sync via ChatDocument (polls map + votes append-only list)
- Lifecycle events: poll mutations + vote.cast + vote.vetoed
- Unit tests: 85%+ coverage, enforcement logic, status transitions, veto validation
- Integration tests: PGlite with real DB ops
- E2E tests: poll lifecycle, voting flows, veto, abstain, multi-vote, close

## Design References

- `packages/db/src/schema/pg/communication.ts` — polls, poll_votes tables
- `packages/sync/src/schemas/chat.ts` — CrdtPoll, CrdtPollOption, CrdtPollVote
- `packages/types/src/encryption.ts` — ServerPoll, ServerPollVote types
- `docs/planning/features.md` section 3 — Poll specification
