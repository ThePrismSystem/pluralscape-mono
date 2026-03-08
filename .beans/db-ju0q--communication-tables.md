---
# db-ju0q
title: Communication tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:33:04Z
updated_at: 2026-03-08T14:21:06Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Chat, board, notes, polls, and acknowledgement tables. Implementation is M5 but schema defined here for completeness.

## Scope

### Tables

- **`channels`**: id (UUID PK), system_id (FK → systems, NOT NULL), sort_order (integer, T3), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, category/type)
- **`messages`**: id (UUID PK), channel_id (FK → channels, NOT NULL), timestamp (T3, NOT NULL), edited_at (T3, nullable), archived (boolean, T3, NOT NULL, default false), encrypted_data (T1, NOT NULL — content, sender proxy id, attachments, mentions, reply_to_id)
- **`board_messages`**: id (UUID PK), system_id (FK → systems, NOT NULL), sort_order (integer, T3), pinned (boolean, T3, NOT NULL, default false), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — content)
- **`notes`**: id (UUID PK), system_id (FK → systems, NOT NULL), member_id (FK → members, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — title, content, background color)
- **`polls`**: id (UUID PK), system_id (FK → systems, NOT NULL), status ('open' | 'closed', T3), created_at (T3, NOT NULL, default NOW()), closed_at (T3, nullable), encrypted_data (T1, NOT NULL — title, options)
- **`poll_votes`**: poll_id (FK → polls, NOT NULL), encrypted_data (T1, NOT NULL — member_id, selected option)
- **`acknowledgements`**: id (UUID PK), system_id (FK → systems, NOT NULL), confirmed (boolean, T3, NOT NULL, default false), confirmed_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, NOT NULL — target member, message)

### Indexes

- messages (channel_id, timestamp)
- channels (system_id)
- board_messages (system_id)

## Acceptance Criteria

- [ ] All 7 tables defined for both dialects
- [ ] Messages with edit tracking (edited_at) and soft-delete (archived)
- [ ] Board messages have sort_order and pinned flag (default false)
- [ ] Channels have sort_order for drag-and-drop
- [ ] Notes support member-bound or system-wide (nullable member_id)
- [ ] Polls with created_at and closed_at
- [ ] Acknowledgements with created_at and default confirmed = false
- [ ] created_at/updated_at on channels, board_messages, notes
- [ ] Migrations for both dialects

## References

- features.md section 3 (Communication)
