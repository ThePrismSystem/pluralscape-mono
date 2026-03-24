---
# ps-9ljf
title: Update docs for M4 completion
status: completed
type: task
priority: normal
created_at: 2026-03-24T15:29:03Z
updated_at: 2026-03-24T15:39:37Z
---

Mark M4 completed, update README/CHANGELOG/milestones/db-schema/api-limits, add test coverage section, remove pr_diff.patch, create /update-docs skill

## Summary of Changes

- Marked Milestone 4 (ps-mmpz) as completed with summary
- README.md: updated status to M0-4 complete, added test coverage table (95.54%/87.37%/96.22%/96.06%), updated ADR count to 27
- CHANGELOG.md: added full Milestone 4 section with Added/Fixed subsections
- milestones.md: marked M4 [COMPLETED] with detailed epic breakdown, added ADR 027
- database-schema.md: removed deprecated switches table, added custom_front_id/structure_entity_id to fronting_comments, added Timers & Check-ins ER diagram
- api-limits.md: added Data Retention section (webhook 30-day cleanup) and full Rate Limits table
- OpenAPI: fixed webhook ref errors (Unauthorized→Unauthenticated, BadRequest→ValidationError, PaginatedResponse→PaginationMeta), added operationIds to analytics and fronting-reports paths, added security to analytics endpoints
- Updated redocly CLI to 2.25.1
- Regenerated bundled OpenAPI spec (172 operations, up from 155)
- Regenerated roadmap from beans
- Removed pr_diff.patch
- Created /update-docs skill at .claude/skills/update-docs/SKILL.md
