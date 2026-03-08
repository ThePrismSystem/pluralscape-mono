---
# types-8klm
title: Communication types
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:27Z
updated_at: 2026-03-08T14:21:42Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Channel, ChatMessage, BoardMessage, Note, Poll, AcknowledgementRequest types

Chat, board, notes, polls, and acknowledgement types. Implementation is M5 but types defined here for completeness.

## Scope

- `Channel`: id (ChannelId), systemId, name, category
- `ChatMessage`: id (MessageId), channelId, senderId (MemberId — proxy), content (rich text), attachments (ref[]), mentions (MemberId[]), timestamp
- `BoardMessage`: id, systemId, content, sortOrder, pinned (boolean)
- `Note`: id (NoteId), systemId, memberId (nullable — member-bound or system-wide), title, content (rich text), backgroundColor (hex)
- `Poll`: id (PollId), systemId, title, options (PollOption[]), status ('open' | 'closed')
- `PollOption`: id, label, voteCount
- `PollVote`: pollId, memberId, optionId (one vote per member)
- `AcknowledgementRequest`: id, systemId, targetMemberId, message, confirmed (boolean), confirmedAt

## Acceptance Criteria

- [ ] All 6 communication entity types defined
- [ ] ChatMessage supports proxy messaging (sender is a member)
- [ ] BoardMessage has sort order for drag-and-drop
- [ ] Note supports member-bound or system-wide scope
- [ ] Poll enforces one vote per member at type level
- [ ] AcknowledgementRequest tracks confirmation state
- [ ] Rich text represented as string (format TBD in M5)

## References

- features.md section 3 (Communication)

## Audit Findings (002)

- ChatMessage missing `editedAt` timestamp for edit tracking
- ChatMessage missing `replyToId` for reply threading
- Channel missing `sortOrder` for ordering
- Channel missing `type` field (categories vs channels distinction)
