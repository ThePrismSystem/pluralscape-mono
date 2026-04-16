---
# mobile-fuw1
title: Wire OPFS driver onDroppedError callback at detect.ts construction site
status: todo
type: task
priority: normal
created_at: 2026-04-16T17:02:45Z
updated_at: 2026-04-16T17:02:45Z
parent: ps-0enb
---

The OPFS driver factory (createOpfsSqliteDriver) accepts OpfsSqliteDriverOptions.onDroppedError, but apps/mobile/src/platform/detect.ts currently constructs the driver without options — meaning dropped lastError values are silently lost in production. Wire a logger-backed callback (use @pluralscape/types Logger) so that two consecutive failing async ops without an intervening flush() produce an observable warning. Identified during PR #459 cleanup review.
