---
# api-l2qt
title: Add friend tRPC router (15 procedures)
status: completed
type: feature
priority: normal
created_at: 2026-04-02T09:46:59Z
updated_at: 2026-04-16T07:29:51Z
parent: ps-n8uk
---

Create friendRouter with 15 procedures matching REST /account/friends/\* endpoints. Uses protectedProcedure (account-level). Endpoints: list, get, accept, reject, block, remove, archive, restore, visibility, dashboard, dashboardSync, export, exportManifest, getNotifications, updateNotifications. See docs/local-audits/trpc-parity-audit.md Domain 10.

## Summary of Changes\n\nAdded friendRouter with 15 procedures to apps/api/src/trpc/routers/friend.ts
