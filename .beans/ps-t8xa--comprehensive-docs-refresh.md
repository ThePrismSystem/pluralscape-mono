---
# ps-t8xa
title: Comprehensive docs refresh
status: completed
type: task
priority: normal
created_at: 2026-05-08T08:37:23Z
updated_at: 2026-05-08T09:45:28Z
---

Refresh all committed user-facing docs for readability. No factual changes. Spec: docs/superpowers/specs/2026-05-08-docs-refresh-design.md

## Tasks

- [x] Root + governance refresh
- [x] CODE_OF_CONDUCT and VALUES dual-version review
- [x] Package READMEs refresh
- [x] Architecture and developer guides refresh
- [x] Reference docs refresh (light)
- [x] ADRs refresh (light)
- [x] Audits + planning + future-features refresh (light)
- [x] OpenAPI descriptions refresh
- [x] Roadmap regenerated
- [x] PR opened

## Summary of Changes

Refreshed ~76 committed user-facing docs across the monorepo for readability over 10 commits on `docs/comprehensive-refresh` (PR #615). No facts, decisions, findings, schemas, or terminology changed; only sentence rhythm and AI-cadence tells. CODE_OF_CONDUCT and VALUES shipped Version B (community 'we'/'you' voice) per user pick. All other docs use third-person voice.

**Verification:** Prettier, ESLint, trpc-parity, Python YAML parse on both OpenAPI files, sha256 checks on ADR `## Decision`/`## Status`/`## Alternatives` sections (remaining drift is em-dash → period/colon only — meaning preserved), sha256 checks on audit `## Findings`/`## Recommendations`/`## Conclusion` sections (zero drift), MUST/SHOULD/MAY count check on planning + future-features (zero drift), cross-cutting terminology sweep clean.

**Commits:** chore(beans) tracker; root + governance; COC + VALUES; package READMEs; architecture + guides; reference docs; ADRs; audits + planning + future-features; OpenAPI descriptions; roadmap regen; chore(beans) checklist close.
