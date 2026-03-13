---
# db-2tzp
title: Add checksum format CHECK constraint to blob_metadata
status: completed
type: task
priority: low
created_at: 2026-03-13T05:00:31Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded CHECK `blob_metadata_checksum_length_check` requiring `length(checksum) = 64` (SHA-256 hex format) on both PG and SQLite. Updated all test fixtures to use 64-char checksums.
