---
# ps-t1fv
title: Document poll-option CRDT/PG asymmetry
status: todo
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T00:53:47Z
parent: ps-y621
---

poll-option has a CRDT strategy and local SQLite entity but no corresponding PG table. Options stored inside poll's encryptedData blob on server but as separate entity in CRDT. This is architecturally intentional (poll options are encrypted) but undocumented.

Fix: add architecture comment in crdt-strategies.ts and/or a note in the relevant ADR.

Audit ref: Pass 8 MEDIUM
