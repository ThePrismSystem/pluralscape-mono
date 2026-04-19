---
# ps-5160
title: Refactor CrowdinTermPayload to discriminated union by term.type
status: scrapped
type: task
priority: low
created_at: 2026-04-19T00:02:35Z
updated_at: 2026-04-19T08:29:25Z
parent: ps-0enb
---

Collapse the duplicated 'is status derived from payload.isDoNotTranslate?' logic in scripts/crowdin/glossary.ts into a discriminated union keyed by term.type. Invasive but clean; deferred out of PR #468 round 3 to keep that PR focused on review-finding fixes. Reference: S12 in the PR #468 round 3 plan.

## Reasons for Scrapping

Deferred low-priority refactor; not pursuing.
