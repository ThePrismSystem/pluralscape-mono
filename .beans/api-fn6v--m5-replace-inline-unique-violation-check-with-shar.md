---
# api-fn6v
title: "M5: Replace inline unique-violation check with shared utility"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:27:04Z
updated_at: 2026-03-28T22:00:09Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M5 (Quality)
**File:** `apps/api/src/services/friend-code.service.ts:155-156`

Inline `"23505"` magic string + `as { code: string }` cast duplicates `isUniqueViolation()` from `lib/unique-violation.ts`.

**Fix:** Replace with `import { isUniqueViolation } from "../lib/unique-violation.js"`.

## Summary of Changes

Replaced the inline unique-violation check (magic string `"23505"` + `as { code: string }` cast) in `friend-code.service.ts` with the shared `isUniqueViolation()` utility from `lib/unique-violation.ts`. This removes code duplication and gains cause-chain walking for wrapped Drizzle errors. Added unit tests for the retry-on-unique-violation and no-retry-on-other-error paths.
