---
# db-lrk6
title: Deduplicate type aliases in pg/index.ts and sqlite/index.ts
status: todo
type: task
priority: low
created_at: 2026-03-10T09:03:16Z
updated_at: 2026-03-10T09:03:16Z
---

pg/index.ts and sqlite/index.ts have identical type alias blocks (~30 lines each) that compound with every schema batch. Refactor options: move Row/New types into individual schema files, or create a shared type generation approach.
