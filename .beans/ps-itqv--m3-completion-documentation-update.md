---
# ps-itqv
title: M3 completion documentation update
status: completed
type: task
priority: normal
created_at: 2026-03-21T09:32:51Z
updated_at: 2026-04-16T07:29:46Z
parent: ps-afy4
---

Update milestones.md, README.md, CHANGELOG.md, and roadmap.md to reflect M3 completion. Mark M2/M3 as completed, update test counts, coverage numbers, ADR count, add M2+M3 CHANGELOG sections, regenerate roadmap.

## Checklist

- [x] Update milestones.md — mark M2 and M3 as COMPLETED, add M3 epics with strikethrough, add ADR 026
- [x] Update README.md — status, test counts, coverage, ADR count, pnpm 10, api-e2e, test:e2e
- [x] Add M2 and M3 sections to CHANGELOG.md
- [x] Regenerate roadmap.md from beans
- [x] Run pnpm format

## Summary of Changes

- Marked M2 and M3 as COMPLETED in milestones.md with full epic descriptions
- Added ADR 026 to milestones.md ADR list
- Updated README.md: status line, test counts (5,499+51 E2E), coverage numbers, pnpm 10, api-e2e directory, test:e2e script, ADR count (26)
- Restructured CHANGELOG.md with M2 and M3 sections
- Regenerated roadmap.md from beans

- Fixed review findings: removed completed bean from roadmap, moved ADR 023 to correct milestone section, qualified CHANGELOG format claim, trimmed README M3 deliverables to one-liner with CHANGELOG link, replaced hardcoded test counts and coverage with dynamic instructions
