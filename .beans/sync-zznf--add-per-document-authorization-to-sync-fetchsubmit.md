---
# sync-zznf
title: Add per-document authorization to sync fetch/submit
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:28:59Z
updated_at: 2026-04-14T09:28:59Z
---

AUDIT [SYNC-S-M3] No check that requesting client's systemId is authorized to access docId on FetchChanges, SubmitChange, FetchSnapshot, SubmitSnapshot. Any authenticated user who knows a documentId can fetch or push.
