---
# db-auki
title: Fix importJobs.updatedAt nullable inconsistency
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:44Z
parent: db-gwpb
---

All other tables use timestamps() helper with notNull. importJobs and exportRequests declare updatedAt directly as nullable. Ref: audit M4
