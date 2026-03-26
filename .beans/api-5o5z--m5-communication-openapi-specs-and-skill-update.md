---
# api-5o5z
title: M5 communication OpenAPI specs and skill update
status: completed
type: task
priority: normal
created_at: 2026-03-26T14:48:50Z
updated_at: 2026-03-26T14:56:50Z
---

Add OpenAPI 3.1 path and schema files for all M5 communication routes (channels, messages, board-messages, notes, polls, acknowledgements). Update the update-docs skill to make OpenAPI spec authoring explicit.

## Summary of Changes

- Updated `/update-docs` skill (v1.0.0 -> v1.1.0) to make OpenAPI spec authoring explicit with step-by-step instructions
- Created 6 schema files: channels, messages, board-messages, notes, polls, acknowledgements
- Created 6 path files with full CRUD + action operations for all M5 communication domains
- Added 48 new operations to the OpenAPI spec (173 -> 221 total)
- Added path references to root openapi.yaml for all new routes
- All specs validated with `pnpm openapi:lint` and formatted with Prettier
