---
# api-l9ar
title: Add structure entity service with HAS_DEPENDENTS checking
status: completed
type: task
priority: normal
created_at: 2026-03-22T07:44:59Z
updated_at: 2026-04-16T07:29:47Z
parent: db-rsn2
---

When structure entity routes are built, the service layer needs proper dependent checks (fieldValues, frontingSessions, entityLinks, memberLinks, associations) to return 409 HAS_DEPENDENTS instead of raw 500 FK violations. No routes exist yet — this is a prerequisite for future structure entity route work.
