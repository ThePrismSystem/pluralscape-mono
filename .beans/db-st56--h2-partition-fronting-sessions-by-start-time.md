---
# db-st56
title: "H2: partition fronting_sessions by start_time"
status: completed
type: task
created_at: 2026-03-13T05:48:56Z
updated_at: 2026-03-13T05:48:56Z
parent: db-hcgk
---

ADR 019: monthly range partitioning on start_time. Composite PK (id, start_time), updated unique constraint, denormalized sessionStartTime on fronting_comments, application-enforced journal_entries FK.
