---
# api-i77b
title: "E2E tests: chat system"
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T07:45:20Z
parent: api-ryy0
blocked_by:
  - api-4uqw
  - api-qno1
---

apps/api-e2e/src/tests/chat/channels.spec.ts (channel CRUD lifecycle) + messages.spec.ts (message CRUD, replies, edits, pagination). Cover: auth (401/403), error responses (404/409), response shapes, archive/restore/delete lifecycle.

## Summary of Changes\n\nCreated E2E tests for channel and message CRUD lifecycles covering: create/get/list/update/archive/restore/delete, hierarchy validation (409 INVALID_HIERARCHY), dependent deletion (409 HAS_DEPENDENTS), reply threading, descending timestamp pagination with cursor, optional timestamp query param, and cross-system access (404).
