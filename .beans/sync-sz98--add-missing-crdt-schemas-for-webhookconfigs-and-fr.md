---
# sync-sz98
title: Add missing CRDT schemas for webhookConfigs and frontingReports
status: completed
type: task
priority: high
created_at: 2026-03-24T09:21:12Z
updated_at: 2026-03-24T09:30:51Z
parent: ps-4ioj
---

Strategy registry references webhookConfigs and frontingReports on SystemCoreDocument but no CrdtWebhookConfig/CrdtFrontingReport interfaces, document fields, or factory initialization exist. Post-merge validator silently skips webhook validation.

## Summary of Changes\n\nAdded CrdtWebhookConfig and CrdtFrontingReport interfaces to system-core.ts. Added webhookConfigs and frontingReports fields to SystemCoreDocument. Initialized both as empty maps in createSystemCoreDocument(). Updated schemas.test.ts inline document initialization.
