---
# db-oll6
title: "T2 db sqlite test splits: 9 schema files + sqlite-helpers"
status: todo
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T05:02:12Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Ten files in packages/db (sqlite scope) ≥750 LOC. See spec PR 5.

## Files (current LOC → target ≤500)

- [ ] helpers/sqlite-helpers.ts (1,893) — split by responsibility (schema init / fixture factory / transaction helpers)
- [ ] schema-sqlite-structure.integration.test.ts (1,795)
- [ ] schema-sqlite-communication.integration.test.ts (1,519)
- [ ] schema-sqlite-custom-fields.integration.test.ts (1,386)
- [ ] schema-sqlite-privacy.integration.test.ts (1,335)
- [ ] schema-sqlite-fronting.integration.test.ts (1,171)
- [ ] schema-sqlite-auth.integration.test.ts (1,106)
- [ ] schema-sqlite-notifications.integration.test.ts (914)
- [ ] schema-sqlite-import-export.integration.test.ts (911)
- [ ] schema-sqlite-timers.integration.test.ts (859)

## Acceptance

- pnpm vitest run --project db-integration passes
- Coverage unchanged or higher
- Every new file ≤500 LOC

## Out of scope

- Schema or migration changes
- pg-side files (separate bean)
