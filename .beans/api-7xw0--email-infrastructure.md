---
# api-7xw0
title: Email infrastructure
status: completed
type: epic
priority: normal
created_at: 2026-03-29T02:20:31Z
updated_at: 2026-03-29T07:00:43Z
parent: ps-n8uk
---

Email sending infrastructure: provider integration, templating, job-based delivery queue. Foundation for transactional emails (recovery key alerts, account notifications).

## Summary of Changes\n\nAll children completed across PRs #310, #311, #316, #318: @pluralscape/email package (adapters, templates, contract tests), encrypted email storage with ADR, email-send job worker with service registry, and recovery key regeneration email.
