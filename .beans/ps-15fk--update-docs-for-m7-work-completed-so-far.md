---
# ps-15fk
title: Update docs for M7 work completed so far
status: completed
type: task
priority: normal
created_at: 2026-03-29T12:35:44Z
updated_at: 2026-04-16T07:29:52Z
parent: ps-n8uk
---

Update README, CHANGELOG, milestones, database-schema, CLAUDE.md to reflect M7 email/webhook work, new ADRs 029-030, email package, audit remediation

## Summary of Changes

### README.md

- Status line: M7 "next" → "in progress" with description of M7 work
- Added `email` package to repository structure
- ADR count: 28 → 30
- ADR description updated to reference email provider selection

### CHANGELOG.md

- Added M7 [Unreleased] section with Added (email package, ADRs 029-030, webhook enhancements, event dispatch) and Fixed (M7 audit remediation high/medium/low)

### docs/planning/milestones.md

- M7 marked [IN PROGRESS] with updated goal (email, webhooks, API audit)
- Added 4 completed M7 epics with detailed descriptions
- Removed import/export/bridge/API key UI epics (moved to M8)
- M8 updated to include import/export/bridge/API key UI epics
- Development sequence rationale updated for M7/M8 scope changes
- ADR count: 28 → 30, added ADR 029 and 030 to the list

### docs/database-schema.md

- Added `encrypted_email` column to accounts table

### CLAUDE.md

- Added `email` to packages list

### OpenAPI spec

- Added webhook rotate-secret and test/ping endpoints (2 new operations, 260 total)
- Added RotateWebhookSecretRequest and WebhookTestResponse schemas
- Added 14 missing webhook event types (bucket, field-bucket-visibility, friend events)
- Bundled spec regenerated and validated

### Generated files

- `docs/openapi.yaml` regenerated via `pnpm openapi:bundle`
- `docs/roadmap.md` regenerated via `pnpm roadmap`
