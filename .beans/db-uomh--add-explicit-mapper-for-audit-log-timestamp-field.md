---
# db-uomh
title: Add explicit mapper for audit_log timestamp field
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

audit_log uses timestamp rather than createdAt. Mapping contract is implicit — make it explicit or rename column. Ref: audit M23
