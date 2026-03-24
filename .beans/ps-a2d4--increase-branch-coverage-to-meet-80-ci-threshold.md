---
# ps-a2d4
title: Increase branch coverage to meet 80% CI threshold
status: in-progress
type: bug
priority: normal
created_at: 2026-03-24T04:22:41Z
updated_at: 2026-03-24T05:43:54Z
---

PR #259 CI fails: branch coverage 78.83% < 80% threshold. Add tests for untested branches in offline-queue-manager.ts, sync-engine.ts, and sqlite-job-worker.ts.

## Updated Scope (2026-03-24)\n\nTarget raised from 80% to 85%+. See plan: glittery-petting-balloon.md\n\n### Phases\n- [x] Phase 0: Lint passes (no issue found locally)\n- [x] Phase 1: 6 new service test files — branch coverage now 86.27%\n- [ ] Phase 2: Extend 5 partial-coverage tests (+45 branches)\n- [ ] Phase 3: S3 adapter unit tests (+35 branches)\n- [ ] Phase 4: Sync + crypto improvements (+25 branches)\n- [ ] Phase 5: Long-tail service branches (+20 branches)\n- [ ] Phase 6: WebSocket/middleware edge cases (buffer)
