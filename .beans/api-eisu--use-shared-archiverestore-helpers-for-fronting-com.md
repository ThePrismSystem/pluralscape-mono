---
# api-eisu
title: Use shared archive/restore helpers for fronting comments and check-ins
status: completed
type: task
priority: high
created_at: 2026-03-24T09:24:08Z
updated_at: 2026-03-24T09:38:19Z
parent: ps-4ioj
---

fronting-comment.service and check-in-record.service implement archive/restore inline instead of using archiveEntity/restoreEntity. Missing ALREADY_ARCHIVED/NOT_ARCHIVED error differentiation.
