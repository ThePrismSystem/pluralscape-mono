---
# types-6rbm
title: Friend dashboard response types
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:05:10Z
updated_at: 2026-03-29T00:48:46Z
parent: client-napj
---

Define FriendDashboardResponse, FriendDashboardMember, FriendDashboardFronter, etc. Shared types usable by server and future client. Files: packages/types/src/friend-data.ts (new), re-export from index.ts. Tests: compile-time type assertions using vitest `expectTypeOf` to verify response type structure, required vs optional fields, and discriminated union narrowing. Runtime exhaustive-switch tests on any union members.
