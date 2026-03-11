---
# db-d8h1
title: Add size limit to importJobs.errorLog JSONB
status: todo
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

No size limit. Failed import with thousands of row errors produces multi-MB blob in single row. Add CHECK or application-level cap. Ref: audit L6
