---
# ps-tfg2
title: Fix pk-error-classifier numeric status comparison
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T11:57:50Z
parent: ps-v7el
---

Finding [Typing H] from audit 2026-04-20 import-pk report. packages/import-pk/src/pk-error-classifier.ts. Compares thrown.status as string ('==="401"', .startsWith("5")); APIError.status from pkapi.js may be a number. If numeric, '==='"401"' always fails and all API errors fall through to recoverable-fatal default. Highest-impact typing gap in import-pk.

## Summary of Changes

pk-error-classifier now normalises thrown.status (number | string | undefined) to number via a dedicated normaliseStatus helper before comparison. Numeric statuses from pkapi.js (sourced from axios response.status at runtime despite the string type declaration) now classify correctly into 401/403 fatal, 429/404/5xx non-fatal, rather than falling through to the fatal-recoverable default. 5xx detection uses a numeric range (>= 500 && < 600) instead of a String.startsWith check that broke on numbers. HTTP status codes extracted to named constants.

Added 20 tests in **tests**/engine/error-classifier.test.ts covering every classification path for both string and numeric status shapes, plus missing/malformed status fallbacks.
