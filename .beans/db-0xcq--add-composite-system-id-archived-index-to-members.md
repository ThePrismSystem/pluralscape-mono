---
# db-0xcq
title: Add composite (system_id, archived) index to members
status: todo
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

Separate archived and system_id indexes force bitmap AND for common get active members query. Ref: audit L3
