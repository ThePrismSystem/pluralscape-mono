---
# sync-vmv4
title: "T2 sync test splits: conflict-resolution, schemas, ws-client-adapter, document-lifecycle, sync-engine-runtime-hardening"
status: todo
type: task
priority: normal
created_at: 2026-04-30T05:01:01Z
updated_at: 2026-04-30T05:02:12Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Five test files in packages/sync ≥750 LOC. See spec docs/superpowers/specs/2026-04-29-test-file-split-epic-design.md PR 4. Each split follows Standard Split Workflow.

## Files (current LOC → target ≤500)

- [ ] conflict-resolution.test.ts (1,548)
- [ ] schemas.test.ts (1,087)
- [ ] adapters/ws-client-adapter.test.ts (1,043)
- [ ] document-lifecycle.test.ts (909)
- [ ] sync-engine-runtime-hardening.test.ts (769)

## Acceptance

- pnpm vitest run --project sync passes
- pnpm vitest run --project sync --coverage shows coverage unchanged or higher
- Every new file ≤500 LOC (stretch 350)
- Original files deleted

## Out of scope

- Refactoring sync engine, conflict resolver, or any production code
- Files <750 LOC
