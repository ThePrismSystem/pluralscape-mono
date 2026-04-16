---
# mobile-11h1
title: Wire OPFS driver onDroppedError callback at detect.ts construction site
status: todo
type: task
priority: normal
created_at: 2026-04-16T17:02:49Z
updated_at: 2026-04-16T17:02:49Z
parent: ps-0enb
---

The OPFS driver factory accepts OpfsSqliteDriverOptions.onDroppedError, but detect.ts constructs the driver without options — dropped lastError values are silently lost in production. Wire a logger-backed callback so two consecutive failing async ops without an intervening flush() produce an observable warning. Identified during PR #459 cleanup review.
