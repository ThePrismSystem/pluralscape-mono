---
# api-u1zw
title: Add archive and delete support for lifecycle events
status: todo
type: task
created_at: 2026-03-21T23:09:30Z
updated_at: 2026-03-21T23:09:30Z
parent: ps-mmpz
---

Lifecycle events are currently append-only in the CRDT strategy. They need archive and delete functionality to support data correction (e.g., mistakenly recorded events). Requires updating the CRDT strategy from append-only to append-lww, and adding archive/delete API endpoints.
