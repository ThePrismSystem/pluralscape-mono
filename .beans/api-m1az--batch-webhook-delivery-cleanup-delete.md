---
# api-m1az
title: Batch webhook delivery cleanup DELETE
status: completed
type: bug
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T07:36:23Z
parent: api-kjyg
---

webhook-delivery-cleanup.ts:24-34 deletes ALL terminal records older than cutoff in a single statement. With millions of deliveries this holds a long-running transaction. The .returning() also buffers every deleted row ID into memory. Delete in batches (LIMIT 1000 in a loop) and use command tag row count instead.

## Summary of Changes

Rewrote cleanupWebhookDeliveries to delete in batches using CTE-based DELETE with LIMIT. Loops until all matching rows are deleted. Configurable batch size (default 1000). Integration test verifies multi-batch cleanup.
