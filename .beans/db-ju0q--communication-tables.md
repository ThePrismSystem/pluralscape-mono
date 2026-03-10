---
# db-ju0q
title: Communication tables
status: in-progress
type: task
priority: normal
created_at: 2026-03-08T13:33:04Z
updated_at: 2026-03-10T04:19:16Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Chat, board, notes, polls, and acknowledgement tables. Implementation is M5 but schema defined here for completeness.

## Scope

### Tables

- **`channels`**: id (UUID PK), system_id (FK → systems, NOT NULL), parent_id (FK → channels, nullable, T3 — for nested categories), version (integer, T3, NOT NULL, default 1), sort_order (integer, T3), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, category/type)
- **`messages`**: id (UUID PK), channel_id (FK → channels, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), version (integer, T3, NOT NULL, default 1), timestamp (T3, NOT NULL), edited_at (T3, nullable), archived (boolean, T3, NOT NULL, default false), encrypted_data (T1, NOT NULL — content, sender proxy id, attachments, mentions, reply_to_id)
- **`board_messages`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), sort_order (integer, T3), pinned (boolean, T3, NOT NULL, default false), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — content, senderId)
- **`notes`**: id (UUID PK), system_id (FK → systems, NOT NULL), member_id (FK → members, nullable), version (integer, T3, NOT NULL, default 1), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — title, content, background color)
- **`polls`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), status ('open' | 'closed', T3), created_at (T3, NOT NULL, default NOW()), closed_at (T3, nullable), encrypted_data (T1, NOT NULL — title, description, options, kind, createdByMemberId, endsAt, allowMultipleVotes, maxVotesPerMember, allowAbstain, allowVeto)
- **`poll_votes`**: id (UUID PK), poll_id (FK → polls, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, NOT NULL — voter (EntityReference), optionId (nullable), comment, isVeto, votedAt)
- **`acknowledgements`**: id (UUID PK), system_id (FK → systems, NOT NULL), confirmed (boolean, T3, NOT NULL, default false), confirmed_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, NOT NULL — target member, message, createdByMemberId)

### Indexes

- messages (channel_id, timestamp)
- channels (system_id)
- board_messages (system_id)
- messages (system_id) — for RLS
- notes (system_id)
- notes (member_id) — for member-bound notes
- polls (system_id)
- poll_votes (poll_id)
- acknowledgements (system_id)
- acknowledgements (confirmed)

### Cascade rules

- System deletion → CASCADE: channels, messages, board_messages, notes, polls, poll_votes, acknowledgements
- Channel deletion → CASCADE: messages
- Poll deletion → CASCADE: poll_votes

## Acceptance Criteria

- [ ] version on channels, messages, board_messages, notes, polls
- [ ] poll_votes has UUID PK, system_id for RLS, created_at
- [ ] messages has system_id for RLS
- [ ] notes and channels have archived/archived_at
- [ ] CASCADE rules defined
- [ ] All 7 tables defined for both dialects
- [ ] Messages with edit tracking (edited_at) and soft-delete (archived)
- [ ] Board messages have sort_order and pinned flag (default false)
- [ ] Channels have sort_order for drag-and-drop
- [ ] Notes support member-bound or system-wide (nullable member_id)
- [ ] Polls with created_at and closed_at
- [ ] Acknowledgements with created_at and default confirmed = false
- [ ] created_at/updated_at on channels, board_messages, notes
- [ ] parent_id on channels for nested categories (T3)
- [ ] Poll expanded with kind, description, voting config fields
- [ ] PollVote with EntityReference voter, optional comment, veto support
- [ ] BoardMessage with senderId
- [ ] AcknowledgementRequest with createdByMemberId
- [ ] Migrations for both dialects

## References

- features.md section 3 (Communication)
