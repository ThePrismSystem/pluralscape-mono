---
# api-bqne
title: Subsystem/group service structural dedup
status: completed
type: task
priority: deferred
created_at: 2026-03-18T12:50:21Z
updated_at: 2026-04-16T07:29:42Z
parent: ps-rdqo
---

P-17 from audit 012: subsystem.service.ts and group.service.ts are structurally near-identical (546+ lines each). Large refactor to extract a shared generic hierarchy service. Deferred due to scope — too large for LOW priority in current batch.
