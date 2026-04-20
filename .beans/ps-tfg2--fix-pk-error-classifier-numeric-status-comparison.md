---
# ps-tfg2
title: Fix pk-error-classifier numeric status comparison
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: ps-v7el
---

Finding [Typing H] from audit 2026-04-20 import-pk report. packages/import-pk/src/pk-error-classifier.ts. Compares thrown.status as string ('==="401"', .startsWith("5")); APIError.status from pkapi.js may be a number. If numeric, '==='"401"' always fails and all API errors fall through to recoverable-fatal default. Highest-impact typing gap in import-pk.
