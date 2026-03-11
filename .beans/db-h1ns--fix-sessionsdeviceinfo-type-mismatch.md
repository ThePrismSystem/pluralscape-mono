---
# db-h1ns
title: Fix sessions.deviceInfo type mismatch
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

DB stores as string column but canonical type is a structured object. Add explicit mapper or change DB type. Ref: audit M21
