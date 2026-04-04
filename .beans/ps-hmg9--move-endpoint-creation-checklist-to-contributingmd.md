---
# ps-hmg9
title: Move endpoint creation checklist to CONTRIBUTING.md
status: completed
type: task
priority: normal
created_at: 2026-04-04T14:38:08Z
updated_at: 2026-04-04T21:42:00Z
parent: ps-7j8n
---

Extract the new endpoint creation checklist from docs/trpc-guide.md into CONTRIBUTING.md (or similar) and add a reference in CLAUDE.md. Currently buried in a tRPC-specific doc but applies broadly.

## Summary of Changes

- Moved endpoint creation checklist and rate limit categories table from docs/trpc-guide.md to CONTRIBUTING.md under new "Adding API Endpoints" subsection
- Replaced original section in docs/trpc-guide.md with a pointer to CONTRIBUTING.md
- Added new <important if> block in CLAUDE.md referencing the checklist for AI-assisted endpoint work
