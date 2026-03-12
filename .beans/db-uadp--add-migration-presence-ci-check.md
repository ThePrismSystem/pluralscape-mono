---
# db-uadp
title: Add migration-presence CI check
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T03:06:53Z
parent: db-764i
---

No CI check that fails if drizzle-kit generate would produce a diff. Add to prevent drift. Ref: audit M31

## Summary of Changes\n\nAdded `migrations` CI job to `.github/workflows/ci.yml` that runs drizzle-kit generate and checks for uncommitted changes.
