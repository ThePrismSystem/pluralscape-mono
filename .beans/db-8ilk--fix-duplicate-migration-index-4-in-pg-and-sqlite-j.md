---
# db-8ilk
title: Fix duplicate migration index 4 in PG and SQLite journals
status: todo
type: bug
priority: critical
created_at: 2026-04-14T09:28:31Z
updated_at: 2026-04-14T09:28:31Z
---

AUDIT [DB-S-C1] Two conflicting idx=4 entries: 0004_nasty_redwing.sql and 0004_oval_domino.sql in PG, mirrored in SQLite. Drizzle migration runner may skip one silently, leaving incomplete event_type allowlist.
