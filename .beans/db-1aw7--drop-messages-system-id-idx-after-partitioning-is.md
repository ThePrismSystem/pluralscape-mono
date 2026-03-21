---
# db-1aw7
title: Drop messages_system_id_idx after partitioning is stable
status: todo
type: task
priority: deferred
created_at: 2026-03-13T11:47:22Z
updated_at: 2026-03-21T10:15:55Z
parent: ps-9u4w
---

Drop the messages_system_id_idx index from both PG and SQLite schemas once PG partitioning is confirmed stable.

**PG**: This index spans all partitions and is redundant — queries should use messages_channel_id_timestamp_idx (partition-pruned) instead.

**SQLite**: Evaluate whether this index is still needed once PG partitioning patterns settle. It has no partition benefit in SQLite but may be kept for schema parity.

See audit 005 M12 for context. Predecessor: db-0wzf (planning).
