---
# api-paqo
title: "Fix PR #148 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-17T03:25:35Z
updated_at: 2026-03-17T03:26:49Z
---

Fix 3 critical schema issues (PG onDelete divergences, inverted comment), add audit log SET NULL exception comments, and add deletion pattern sections to 6 epic beans

## Summary of Changes

- Fixed PG key-rotation.ts: bucketId and rotationId FKs changed from CASCADE to RESTRICT
- Fixed PG import-export.ts: blobId FK changed from SET NULL to RESTRICT with updated comment
- Fixed inverted fronting comment in both PG and SQLite schemas
- Added SET NULL exception comments to audit-log in both PG and SQLite schemas
- Added deletion pattern sections to 6 epic beans (privacy-buckets, front-logging, chat, webhooks, timers, private-notes)
