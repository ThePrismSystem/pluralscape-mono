---
# ps-bamk
title: Simply Plural import SQLite persister integration tests
status: todo
type: task
created_at: 2026-04-09T20:40:59Z
updated_at: 2026-04-09T20:40:59Z
parent: ps-nrg4
blocked_by:
  - ps-nrg4
---

Replace in-memory-persister-backed engine tests with real SQLite persister tests once Plan 3 lands the persister. Coverage gaps to fill: real FK constraint violations, transaction rollback on fatal error mid-flush, encrypted blob payload roundtripping, ID translation table cold-start reload after operator restart, duplicate \_id handling at persister layer, checkpoint schemaVersion mismatch on resume, real-DB api-source 5xx/timeout/close-cancels-fetch tests. Deferred from PR #402 review (2026-04-09).
