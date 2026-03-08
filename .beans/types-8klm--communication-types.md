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

Chat, board, notes, polls, and acknowledgement types. Implementation is M5 but types defined here.

## Scope

- `Channel`: id (ChannelId), systemId, name, type ('category' | 'channel'), sortOrder (number), createdAt, updatedAt
- `ChatMessage`: id (MessageId), channelId, senderId (MemberId — proxy), content (rich text), attachments (ref[]), mentions (MemberId[]), replyToId (MessageId | null), timestamp, editedAt (UnixMillis | null)
- `BoardMessage`: id (BoardMessageId), systemId, content, sortOrder, pinned (boolean), createdAt, updatedAt
- `Note`: id (NoteId), systemId, memberId (nullable — member-bound or system-wide), title, content (rich text), backgroundColor (hex), createdAt, updatedAt
- `Poll`: id (PollId), systemId, title, options (PollOption[]), status ('open' | 'closed'), createdAt, closedAt
- `PollOption`: id, label, voteCount
- `PollVote`: pollId, memberId, optionId (one vote per member)
- `AcknowledgementRequest`: id (AcknowledgementId), systemId, targetMemberId, message, confirmed (boolean), confirmedAt, createdAt

## Acceptance Criteria

- [ ] All 6 communication entity types defined
- [ ] ChatMessage with editedAt and replyToId
- [ ] Channel with type ('category' | 'channel') and sortOrder
- [ ] BoardMessage with BoardMessageId and pinned flag
- [ ] AcknowledgementRequest with AcknowledgementId and createdAt
- [ ] Note supports member-bound or system-wide scope
- [ ] Poll enforces one vote per member at type level
- [ ] Rich text represented as string (format TBD in M5)

## References

- features.md section 3 (Communication)
