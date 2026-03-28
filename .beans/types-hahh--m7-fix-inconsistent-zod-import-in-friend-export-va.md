---
# types-hahh
title: "M7: Fix inconsistent zod import in friend-export validation"
status: completed
type: bug
priority: normal
created_at: 2026-03-28T21:27:11Z
updated_at: 2026-03-28T21:55:48Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M7 (Quality)
**File:** `packages/validation/src/friend-export.ts:2`

Imports from `"zod"` while all other schemas import `"zod/v4"`. Inconsistent and could cause type incompatibilities.

**Fix:** Change `import { z } from "zod"` to `import { z } from "zod/v4"`.

## Summary of Changes

Changed zod import in `packages/validation/src/friend-export.ts` from `"zod"` to `"zod/v4"` for consistency with all other validation schemas.
