---
# types-yk6p
title: Add contract tests between types and Zod schemas
status: completed
type: task
priority: normal
created_at: 2026-03-09T12:13:44Z
updated_at: 2026-03-17T21:35:43Z
parent: ps-rdqo
blocked_by:
  - types-onob
---

Add contract tests early in M2 that verify TypeScript type definitions and Zod validation schemas stay in sync. These will catch drift immediately when either side changes. Block on Zod alignment strategy decision.

Source: Architecture Audit 004, Metric 6

## Summary of Changes\n\nAdded request body types to packages/types (CreateMemberBody, UpdateMemberBody, DuplicateMemberBody, CreateMemberPhotoBody, CreateFieldDefinitionBody, UpdateFieldDefinitionBody, SetFieldValueBody, UpdateFieldValueBody). Added compile-time (expectTypeOf) and runtime (safeParse) contract tests for all member, photo, and field schemas.
