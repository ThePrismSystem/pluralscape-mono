---
# db-7xrs
title: Evaluate dual indexes on lifecycleEvents
status: todo
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

(system_id, occurred_at) and (system_id, recorded_at) both maintained. Write amplification for append-heavy table. Check if recorded_at queries are actually issued. Ref: audit L5
