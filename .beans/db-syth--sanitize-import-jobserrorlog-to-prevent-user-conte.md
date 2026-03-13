---
# db-syth
title: Sanitize import_jobs.errorLog to prevent user content leaks
status: completed
type: task
priority: low
created_at: 2026-03-13T05:00:31Z
updated_at: 2026-03-13T06:25:23Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded JSDoc to `import_jobs.errorLog` column (PG + SQLite) documenting that error messages must be sanitized to exclude user-generated content.
