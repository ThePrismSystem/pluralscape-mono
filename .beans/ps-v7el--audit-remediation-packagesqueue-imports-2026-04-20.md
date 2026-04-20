---
# ps-v7el
title: "Audit remediation: packages/queue + imports (2026-04-20)"
status: completed
type: epic
priority: high
created_at: 2026-04-20T09:20:30Z
updated_at: 2026-04-20T11:58:11Z
parent: ps-h2gl
---

Remediation from comprehensive audit 2026-04-20. Queue job.data casts + import-pk HTTPS guard/error-classifier. See docs/local-audits/comprehensive-audit-2026-04-20/queue.md and import-pk.md. Tracking: ps-g937.

## Summary of Changes

Completed 3 high-priority audit findings:

- ps-74xz: fix(queue) — parseJobDataOrThrow helper replaces 7 bare StoredJobData casts in write paths; each method now throws QueueCorruptionError on corrupt job.data instead of silently producing a malformed JobDefinition. 7 new integration tests.
- ps-ts6a: fix(import-pk) — assertBaseUrlIsSafe + assertTokenIsSane guards at createPkApiImportSource entry match the import-sp pattern; prevents PK token exfiltration over plain HTTP or blank Authorization headers. 8 new unit tests.
- ps-tfg2: fix(import-pk) — pk-error-classifier normalises thrown.status (number | string | undefined) before comparison; numeric statuses from pkapi.js (via axios) now classify correctly into 401/403/5xx instead of falling through to fatal-recoverable. 20 new unit tests.
