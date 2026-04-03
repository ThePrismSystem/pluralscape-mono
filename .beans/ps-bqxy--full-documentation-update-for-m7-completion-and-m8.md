---
# ps-bqxy
title: Full documentation update for M7 completion and M8 prep
status: completed
type: task
priority: normal
created_at: 2026-04-03T01:08:32Z
updated_at: 2026-04-03T01:17:51Z
---

Complete /update-docs pass: mark M7 complete, add tRPC parity as final M7 entries, update all stale docs, groom M8 beans. Triggered before mobile app starts consuming tRPC endpoints.

- [x] Gather current stats (ADR count, E2E count, coverage, OpenAPI ops)
- [x] Check recently completed beans
- [x] Review and update README.md
- [x] Review and update CHANGELOG.md
- [x] Review and update milestones.md
- [x] Review and update CONTRIBUTING.md (no changes needed)
- [x] Review and update features.md
- [x] Review api-specification.md, api-limits.md, database-schema.md, work-tracking.md (no changes needed)
- [x] Check OpenAPI coverage against route domains (coverage complete)
- [x] Regenerate roadmap and OpenAPI bundle
- [x] Groom M8 beans
- [x] Verify formatting and OpenAPI lint

## Summary of Changes

Full documentation pass for M7 completion and M8 prep:

- **README.md**: Updated status to M0-7 complete, M8 next. Added tRPC layer mention. Updated coverage (95.54/87.37/96.22/96.06), E2E count (314), ADR count (33), OpenAPI ops (304).
- **CHANGELOG.md**: Marked M7 complete (removed [Unreleased]). Added tRPC internal API layer, ADRs 031-032, API/tRPC consumer guides, OpenAPI expansion, parity remediation fixes.
- **milestones.md**: Marked M7 [COMPLETED]. Added 3 new completed epics (tRPC layer, parity enforcement, API documentation). Updated goal line.
- **features.md**: Updated section 9 with tRPC internal API, 304 OpenAPI operations, rate limiting details, consumer guides.
- **M8 beans**: Marked milestone in-progress (M7 blocker resolved). Marked 4 foundation epics + 16 child tasks completed (all delivered in PR #352). 6 data hooks epics with 31 child tasks remain todo.
- **Regenerated**: roadmap.md, openapi.yaml. Verified: format clean, OpenAPI lint passes.
