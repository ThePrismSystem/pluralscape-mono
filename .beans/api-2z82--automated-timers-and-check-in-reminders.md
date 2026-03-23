---
# api-2z82
title: Automated timers and check-in reminders
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T03:26:06Z
parent: ps-mmpz
---

Scheduled notifications, waking hours only

### Deletion pattern

Configs: API returns 409 HAS_DEPENDENTS if check-in records exist. Records: leaf entities, always deletable. Archival always allowed regardless of dependents.
