---
# db-8h0o
title: Fix fronting_comments column naming mismatch
status: scrapped
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T21:24:17Z
parent: db-gwpb
---

DB column is session_id but type field is frontingSessionId. Ref: audit M19

## Reasons for Scrapping\n\nNot a bug. Standard Drizzle ORM snake_case → camelCase column mapping. The column name `fronting_session_id` correctly maps to `frontingSessionId` in TypeScript.
