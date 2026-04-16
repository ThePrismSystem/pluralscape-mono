---
# api-kt5h
title: Add integration tests for tRPC routers
status: todo
type: task
priority: normal
created_at: 2026-04-02T08:37:25Z
updated_at: 2026-04-16T06:49:51Z
parent: ps-0enb
---

All 30 tRPC router test files are unit-only with mocked services. CLAUDE.md requires integration tests covering auth, CRUD for all entities. Write integration tests hitting real tRPC context and database for each router.
