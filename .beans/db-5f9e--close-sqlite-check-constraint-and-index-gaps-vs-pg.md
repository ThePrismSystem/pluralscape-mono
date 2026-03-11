---
# db-5f9e
title: Close SQLite CHECK constraint and index gaps vs PG
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:46Z
parent: db-q3r3
---

blob_metadata missing purpose_check, size_bytes>0, encryption_tier IN(1,2), storageKey length. device_tokens missing platform_check. notification_configs missing event_type_check. webhook_deliveries missing event_type_check, status_check, attempt_count_check, http_status_check. sync_queue missing compound (systemId, entityType, entityId) index. Ref: audit H2
