---
# db-im18
title: "T2 db pg test splits: 10 schema files + pg-helpers + schema-type-parity"
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

Twelve files in packages/db (pg scope) ≥750 LOC. See spec PR 6.

## Files

- [ ] helpers/pg-helpers.ts (963)
- [ ] schema-pg-structure.integration.test.ts (1,668)
- [ ] schema-pg-communication.integration.test.ts (1,573)
- [ ] schema-pg-custom-fields.integration.test.ts (1,250)
- [ ] schema-pg-fronting.integration.test.ts (1,163)
- [ ] schema-pg-privacy.integration.test.ts (1,162)
- [ ] schema-pg-auth.integration.test.ts (1,016)
- [ ] schema-pg-import-export.integration.test.ts (1,014)
- [ ] schema-pg-notifications.integration.test.ts (809)
- [ ] schema-pg-timers.integration.test.ts (761)
- [ ] schema-pg-views.integration.test.ts (752)
- [ ] schema-type-parity.test.ts (909)

## Acceptance

- pnpm vitest run --project db-integration passes
- Coverage unchanged or higher

## Out of scope

- Schema or migration changes
- sqlite-side files
