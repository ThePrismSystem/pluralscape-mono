---
# sync-zznf
title: Add per-document authorization to sync fetch/submit
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:28:59Z
updated_at: 2026-04-14T10:29:30Z
---

AUDIT [SYNC-S-M3] No check that requesting client's systemId is authorized to access docId on FetchChanges, SubmitChange, FetchSnapshot, SubmitSnapshot. Any authenticated user who knows a documentId can fetch or push.

## Summary of Changes

Per-document authorization was already implemented in the message router via checkAccess(), which verifies sync_documents.system_id matches the authenticated system for all four sync handlers (FetchSnapshot, FetchChanges, SubmitChange, SubmitSnapshot) plus DocumentLoad and Subscribe. Uses in-memory ownership cache with DB fallback on cache miss.
