---
# db-d8h1
title: Add size limit to importJobs.errorLog JSONB
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T10:08:06Z
parent: db-2nr7
---

No size limit. Failed import with thousands of row errors produces multi-MB blob in single row. Add CHECK or application-level cap. Ref: audit L6

## Summary of Changes\n\nAdded CHECK constraint on import_jobs.error_log limiting to 1,000 array entries (PG: jsonb_array_length, SQLite: json_array_length). Tests verify boundary acceptance/rejection.
