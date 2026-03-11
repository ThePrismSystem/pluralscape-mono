---
# db-fymu
title: Fix messages.sender_id zero-knowledge violation
status: todo
type: bug
priority: critical
created_at: 2026-03-11T08:08:59Z
updated_at: 2026-03-11T19:39:42Z
parent: db-bbzk
---

senderId is plaintext in both ServerChatMessage and ServerBoardMessage with real DB columns (chat_messages.sender_id, board_messages.sender_id). This leaks message attribution to the server, violating zero-knowledge. Move sender_id into encryptedData (T1) and remove the plaintext columns from PG and SQLite schemas.

## Tasks

- [ ] Remove chat_messages.sender_id column (PG + SQLite)
- [ ] Remove board_messages.sender_id column (PG + SQLite)
- [ ] Update ServerChatMessage type (remove senderId)
- [ ] Update ServerBoardMessage type (remove senderId)
- [ ] Update tier map comments
- [ ] Update test helpers DDL
- [ ] Update integration tests
- [ ] Add type-level absence assertions
- [ ] Add negative DB assertions
