---
# api-4yg9
title: Data freshness headers
status: todo
type: feature
created_at: 2026-03-26T16:05:42Z
updated_at: 2026-03-26T16:05:42Z
parent: client-q5jh
blocked_by:
  - client-q5jh
---

Add Last-Modified / ETag headers on friend data endpoint. Support If-Modified-Since / If-None-Match -> 304 when unchanged. ETag computed from ALL relevant high-water marks: max updatedAt across entities, permission changes (bucket assignments, tag edits, key grant revocations, archive/restore), and request params. Not just entity updatedAt. Files: apps/api/src/lib/friend-data-freshness.ts (new), modify routes/friends/data.ts. Tests: integration; 304 when unchanged, 200 when changed.
