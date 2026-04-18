---
# ps-sxfi
title: Polish Crowdin integration and CI automation
status: in-progress
type: feature
priority: normal
created_at: 2026-04-18T04:21:46Z
updated_at: 2026-04-18T18:54:58Z
---

Polish the Crowdin integration: auto-merge CI workflow for translation-only PRs, glossary setup with plurality/DID terminology, pre-fill translations, AI initial translations (superseded by manual), and other best-practice polish.

Parent of (eventually): child tasks for each sub-area (workflow, glossary, pre-translate, AI, docs).

## Context

- Integration landed in PR #465 (d8e71080), daily sync tuning in PR #467 (25ff98ec)
- Config: `crowdin.yml`
- Workflow: `.github/workflows/crowdin-sync.yml`
- Bootstrap script: `scripts/crowdin-add-target-languages.sh`
- Sources: `apps/mobile/locales/en/*.json` (auth, common, fronting, members, settings)
- 12 target languages with Crowdin->repo code mapping (es-ES->es, zh-CN->zh-Hans, others 1:1)

## Todo

- [x] Brainstorm + design (this session)
- [x] Write spec to docs/superpowers/specs/2026-04-18-crowdin-polish-design.md (local-only, gitignored)
- [ ] Create implementation plan
- [ ] Implement (subsequent sessions)
