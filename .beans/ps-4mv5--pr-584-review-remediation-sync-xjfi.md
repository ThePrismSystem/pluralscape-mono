---
# ps-4mv5
title: "PR #584 review remediation (sync-xjfi)"
status: in-progress
type: task
priority: normal
created_at: 2026-04-28T21:03:38Z
updated_at: 2026-04-28T21:35:19Z
---

Address all critical, important, and suggestion findings from the multi-agent review of PR #584 per plan at .claude/plans/woolly-roaming-nova.md. 9 commits planned.

## Implementation checklist

- [x] Commit 1 — fix(sync): brand documentId in event-map (I2) [3aae5dc4]
- [x] Commit 2 — refactor(sync): tighten MaterializerDb param types (I6) [5eeeea17]
- [x] Commit 3+4 — refactor(sync, data): move transaction wrap to subscriber, F1 NoActiveSessionError handling, I3 sync:error on materialize throw, S2/S4/S5/S8 cleanup [2dad9123]
- [x] Commit 5 — refactor(mobile): discriminated PlatformStorage + isSqliteBackend helper (I7) [b9ad1bc4]
- [x] Commit 6 — fix(mobile): SyncProvider catch clears engine state + comment + ref consolidation + bus inlining (I4 + S6 + S10 + S11) [ca9e5dd7]
- [x] Commit 7 — fix(mobile): logger.warn on SQLCipher wipe (I5) [15195bbb]; S7 (runStatement) skipped — see commit body
- [x] Commit 8 — docs(mobile): reworded adapter transaction JSDoc (I1 docs + S3) [folded into commit 5eeeea17]
- [x] Commit 9 — test: branch coverage, disposal-order, lock/unlock, registry isolation (S1 + S12)

Plan reference: /home/theprismsystem/.claude/plans/woolly-roaming-nova.md
