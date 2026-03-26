---
# api-90im
title: Acknowledgement validation schemas
status: completed
type: task
priority: critical
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:11:34Z
parent: api-vjmu
---

packages/validation/src/acknowledgement.ts — Create (targetMemberId, message), Confirm, List (filter by confirmed/pending) schemas. Tests: unit tests for all schemas.

## Summary of Changes\n\nCreated `packages/validation/src/acknowledgement.ts` with three Zod schemas:\n- `CreateAcknowledgementBodySchema`: encryptedData + optional createdByMemberId\n- `ConfirmAcknowledgementBodySchema`: optional encryptedData for blob update\n- `AcknowledgementQuerySchema`: confirmed filter (optional tri-state) + includeArchived\n\nAdded comprehensive unit tests and barrel export.
