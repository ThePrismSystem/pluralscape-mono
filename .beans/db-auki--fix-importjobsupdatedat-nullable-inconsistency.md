---
# db-auki
title: Fix importJobs.updatedAt nullable inconsistency
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

All other tables use timestamps() helper with notNull. importJobs and exportRequests declare updatedAt directly as nullable. Ref: audit M4
