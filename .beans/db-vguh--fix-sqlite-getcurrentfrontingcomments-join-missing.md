---
# db-vguh
title: Fix SQLite getCurrentFrontingComments join missing systemId
status: todo
type: bug
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-03-24T09:25:31Z
parent: ps-4ioj
---

SQLite getCurrentFrontingComments joins only on frontingSessionId without systemId, weaker than the PG equivalent.
