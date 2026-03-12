---
# db-5f9e
title: Close SQLite CHECK constraint and index gaps vs PG
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T04:11:14Z
parent: db-q3r3
---

blob_metadata missing purpose_check, size_bytes>0, encryption_tier IN(1,2), storageKey length. device_tokens missing platform_check. notification_configs missing event_type_check. webhook_deliveries missing event_type_check, status_check, attempt_count_check, http_status_check. sync_queue missing compound (systemId, entityType, entityId) index. Ref: audit H2

## Summary of Changes\n\nAdded 11 CHECK constraints and 2 indexes to align SQLite schemas with PostgreSQL:\n- blob_metadata: purpose enum, size_bytes > 0, encryption_tier IN (1,2)\n- device_tokens: platform enum\n- notification_configs: event_type enum\n- webhook_deliveries: event_type enum, status enum, attempt_count >= 0, http_status range\n- sync_queue: compound (systemId, entityType, entityId) index, unsynced partial index
