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

- `channels`: id, system_id, encrypted_data (T1 — name, category)
- `messages`: id, channel_id (FK), timestamp (T3), encrypted_data (T1 — content, sender proxy id, attachments, mentions)
- `board_messages`: id, system_id, sort_order, encrypted_data (T1 — content)
- `notes`: id, system_id, member_id (nullable), encrypted_data (T1 — title, content, background color)
- `polls`: id, system_id, status ('open'|'closed'), encrypted_data (T1 — title, options)
- `poll_votes`: poll_id (FK), encrypted_data (T1 — member_id, selected option)
- `acknowledgements`: id, system_id, confirmed (boolean), confirmed_at (nullable), encrypted_data (T1 — target member, message)

## Acceptance Criteria

- [ ] All 7 tables defined for both dialects
- [ ] Messages indexed on (channel_id, timestamp)
- [ ] Board messages have sort_order
- [ ] Notes support member-bound or system-wide (nullable member_id)
- [ ] Polls track open/closed status in plaintext
- [ ] Migrations for both dialects

## References

- features.md section 3 (Communication)

## Audit Findings (002)

- Missing `created_at`, `updated_at` on channels
- Missing `edited_at` on messages for edit tracking
- Missing `archived`/`deleted` soft-delete on messages
- Missing `pinned` column on board_messages (matches types-8klm)
- Missing `created_at`, `updated_at` on board_messages
- Missing `created_at`, `updated_at` on notes
- Missing `created_at`, `closed_at` on polls
- Missing `created_at` on acknowledgements
- Missing `sort_order` on channels for drag-and-drop
