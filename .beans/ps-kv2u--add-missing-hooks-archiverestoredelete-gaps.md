---
# ps-kv2u
title: "Add missing hooks: archive/restore/delete gaps"
status: todo
type: task
priority: high
created_at: 2026-04-06T00:52:38Z
updated_at: 2026-04-06T00:52:38Z
parent: ps-y621
---

Multiple entities have CRUD hooks but are missing archive/restore/delete. Add hooks for:

- Member delete (use-members.ts)
- Fronting session archive/restore/delete (use-fronting-sessions.ts)
- Custom front archive/restore (use-custom-fronts.ts)
- Fronting report archive/restore (use-fronting-reports.ts)
- Timer config and check-in archive/restore (use-timer-check-in.ts)
- Privacy bucket delete (use-privacy-buckets.ts)
- Field definition archive/restore (use-custom-fields.ts)
- Group archive/restore (use-groups.ts)

Audit ref: Pass 1 HIGH (member delete, fronting, custom front, report, timer, bucket) + MEDIUM (field def) + LOW (group)
