---
# mobile-11h1
title: Wire OPFS driver onDroppedError callback at detect.ts construction site
status: scrapped
type: task
priority: normal
created_at: 2026-04-16T17:02:49Z
updated_at: 2026-04-17T02:58:53Z
parent: ps-0enb
---

The OPFS driver factory accepts OpfsSqliteDriverOptions.onDroppedError, but detect.ts constructs the driver without options — dropped lastError values are silently lost in production. Wire a logger-backed callback so two consecutive failing async ops without an intervening flush() produce an observable warning. Identified during PR #459 cleanup review.

## Reasons for Scrapping

Obsolete. The new OPFS driver architecture in mobile-shr0 (PR #461) removed the deferred-error model (lastExecPromise / lastError / onDroppedError callback) entirely. Each operation now rejects on its own promise — there are no dropped errors to surface. The fallback observability concern this bean adjacent-touched is addressed in PR #461 by a console.error on the OPFS→IndexedDB fallback path.
