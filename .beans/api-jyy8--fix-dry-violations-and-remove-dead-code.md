---
# api-jyy8
title: Fix DRY violations and remove dead code
status: in-progress
type: task
priority: normal
created_at: 2026-03-18T20:09:13Z
updated_at: 2026-03-18T20:13:21Z
parent: api-mzn0
---

Replace parseIdParam+as-string with requireIdParam, parallelize checkDependents, consolidate MS_PER_DAY, remove unused @trpc/server dependency.

## TODO

- [x] Replace parseIdParam+as-string with requireIdParam in members/delete.ts
- [x] Replace parseIdParam+as-string with requireIdParam in fields/delete.ts
- [x] Replace parseIdParam+as-string with requireIdParam in members/photos/delete.ts
- [x] Replace parseIdParam+as-string with requireIdParam in members/memberships.ts
- [x] Parallelize checkDependents in hierarchy-service-factory.ts with Promise.all
- [x] Export MS_PER_DAY from packages/types/src/api-constants.ts
- [x] Import MS_PER_DAY in audit-log.ts from @pluralscape/types
- [x] Import MS_PER_DAY in jobs.constants.ts from @pluralscape/types
- [x] Remove @trpc/server from apps/api/package.json
- [x] Add placeholder comment to packages/api-client/src/index.ts
- [x] Update affected tests
- [x] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api
