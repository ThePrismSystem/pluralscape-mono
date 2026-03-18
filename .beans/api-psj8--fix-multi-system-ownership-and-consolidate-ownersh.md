---
# api-psj8
title: Fix multi-system ownership and consolidate ownership modules
status: in-progress
type: bug
priority: critical
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:42:05Z
parent: api-i2pw
---

Three ownership modules exist (assert-system-ownership.ts, system-ownership.ts, verify-system-ownership.ts). The in-memory assertSystemOwnership sets auth.systemId from first system via leftJoin, breaking multi-system accounts. Consolidate into one module, use DB-backed verification everywhere, fix 403->404 for fail-closed privacy. Ref: audit S-2, S-5, P-1, S-13.

## Todo Items\n\n- [ ] Rewrite system-ownership.ts to use PostgresJsDatabase\n- [ ] Delete assert-system-ownership.ts\n- [ ] Delete verify-system-ownership.ts\n- [ ] Update audit-writer.ts and audit-log.ts DB types to PostgresJsDatabase\n- [ ] Migrate 14 sync-assert services to DB-backed assert\n- [ ] Migrate 4 verify services to assertSystemOwnership\n- [ ] Update Category A tests (9 files — mock path/name changes)\n- [ ] Update Category B tests (14 files — add mocks, fix 403→404)\n- [ ] Update remaining test files (audit-writer, route tests)\n- [ ] Run full test suite: pnpm vitest run --project api\n- [ ] Verify no remaining references to deleted files
