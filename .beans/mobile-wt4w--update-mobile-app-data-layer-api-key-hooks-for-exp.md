---
# mobile-wt4w
title: Update mobile app data layer API key hooks for expanded scopes
status: draft
type: task
created_at: 2026-04-06T18:39:41Z
updated_at: 2026-04-06T18:39:41Z
blocked_by:
  - api-u998
---

Ensure the mobile app's data layer hooks for API key management (create, update, list, revoke) work with the expanded scope system from api-u998. The scope picker UI needs to present the new triplet model (read/write/delete per entity) and aggregate scopes (read-all, write-all, delete-all, full). Verify type alignment between @pluralscape/types ApiKeyScope and the mobile app.
