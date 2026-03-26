---
# sync-sqfo
title: Use branded ID keys in CRDT sync schema Record types
status: draft
type: task
priority: deferred
created_at: 2026-03-26T12:23:26Z
updated_at: 2026-03-26T12:23:26Z
---

Change Record<string, CrdtX> to Record<XId, CrdtX> in CRDT sync schemas (bucket.ts, chat.ts, fronting.ts, journal.ts). Needs serialization impact analysis. Deferred from M5 audit (L9).
