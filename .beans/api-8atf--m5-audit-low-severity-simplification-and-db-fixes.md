---
# api-8atf
title: M5 audit low-severity simplification and DB fixes
status: todo
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T07:43:55Z
parent: ps-106o
---

Batch of low-severity simplification, DB, and miscellaneous findings from M5 audit.

## Tasks

- [ ] L10: Move optionalBooleanQueryParam from acknowledgement.ts to shared query-params.ts
- [ ] L11: Extract duplicated delete pattern across 3+ services to entity-lifecycle.ts
- [ ] L12: Consider extracting duplicated get-by-id pattern (optional, each is ~15 lines)
- [ ] L13: Remove redundant unique constraint messages(id, timestamp) — PK already enforces
- [ ] L14: Add null-pair constraint for poll_votes.voter/optionId (or document design choice)
