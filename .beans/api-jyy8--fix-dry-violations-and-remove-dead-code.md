---
# api-jyy8
title: Fix DRY violations and remove dead code
status: todo
type: task
created_at: 2026-03-18T20:09:13Z
updated_at: 2026-03-18T20:09:13Z
parent: api-mzn0
---

Replace parseIdParam+as-string with requireIdParam, parallelize checkDependents, consolidate MS_PER_DAY, remove unused @trpc/server dependency.

## TODO

- [ ] Replace parseIdParam+as-string with requireIdParam in members/delete.ts
- [ ] Replace parseIdParam+as-string with requireIdParam in fields/delete.ts
- [ ] Replace parseIdParam+as-string with requireIdParam in members/photos/delete.ts
- [ ] Replace parseIdParam+as-string with requireIdParam in members/memberships.ts
- [ ] Parallelize checkDependents in hierarchy-service-factory.ts with Promise.all
- [ ] Export MS_PER_DAY from packages/types/src/api-constants.ts
- [ ] Import MS_PER_DAY in audit-log.ts from @pluralscape/types
- [ ] Import MS_PER_DAY in jobs.constants.ts from @pluralscape/types
- [ ] Remove @trpc/server from apps/api/package.json
- [ ] Add placeholder comment to packages/api-client/src/index.ts
- [ ] Update affected tests
- [ ] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api
