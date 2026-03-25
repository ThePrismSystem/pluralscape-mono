---
# api-i77b
title: "E2E tests: chat system"
status: todo
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T05:59:19Z
parent: api-ryy0
---

apps/api-e2e/src/tests/chat/channels.spec.ts (channel CRUD lifecycle) + messages.spec.ts (message CRUD, replies, edits, pagination). Cover: auth (401/403), error responses (404/409), response shapes, archive/restore/delete lifecycle.
