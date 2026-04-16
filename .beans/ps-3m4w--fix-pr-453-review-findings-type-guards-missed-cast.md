---
# ps-3m4w
title: "Fix PR #453 review findings: type guards, missed casts, MS_PER_SECOND"
status: in-progress
type: task
priority: normal
created_at: 2026-04-16T09:34:33Z
updated_at: 2026-04-16T10:02:57Z
parent: ps-0enb
---

Fix all critical/important issues and suggestions from PR #453 review

## Tasks

- [x] Fix `AssertAllPrefixesMapped` dead code — add type-level consumer
- [x] Add `AssertAllEntityTypesMapped` guard for EntityTypeIdMap
- [x] Fix `parsed.voter` cast in poll-vote.service.ts
- [x] Convert remaining production casts in apps/api/src/ (lib/, ws/, routes/)
- [x] Convert production casts in packages/ (data, sync, import-sp, queue, storage, crypto)
- [x] Convert production casts in apps/mobile/src/
- [x] Export MS_PER_SECOND from @pluralscape/types and consolidate all definitions
- [ ] Verify typecheck passes
- [ ] Verify tests pass
