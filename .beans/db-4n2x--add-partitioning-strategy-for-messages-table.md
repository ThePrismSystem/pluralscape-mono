---
# db-4n2x
title: Add partitioning strategy for messages table
status: todo
type: task
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T04:47:30Z
parent: db-2je4
---

At 500k systems x 50 messages/day, messages reaches ~9.1B rows. No range or hash partitioning declared. Needs declarative range partitioning by timestamp with sub-partitioning by hash on system_id. All three audit models flagged this. Ref: audit CR9
