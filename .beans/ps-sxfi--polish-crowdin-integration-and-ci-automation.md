---
# ps-sxfi
title: Polish Crowdin integration and CI automation
status: completed
type: feature
priority: normal
created_at: 2026-04-18T04:21:46Z
updated_at: 2026-04-19T22:56:37Z
parent: ps-0enb
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
- [x] Create implementation plan (docs/superpowers/plans/2026-04-18-crowdin-polish-implementation.md)
- [x] Implement

## Summary of Changes

- Glossary source of truth at scripts/crowdin-glossary.json (89 terms covering plurality identity, roles, fronting states, origins, tulpamancy, introjects, alterhuman, moderation discourse, and a negative glossary for pathologizing terms).
- Idempotent setup script (scripts/crowdin-setup-project.ts) applies target languages, glossary, MT engines (DeepL + Google), and QA checks — triggered by scripts/crowdin/ changes via .github/workflows/crowdin-config.yml.
- Pre-translate script (scripts/crowdin-pretranslate.ts) integrated into crowdin-sync workflow after source upload.
- Auto-merge workflow (.github/workflows/crowdin-automerge.yml) with pure-TS guard (13 unit tests covering every skip reason); ships in dry-run mode, flipped to live in a follow-up PR.
- ADR 036 captures the transitional-MT decision and commits to superseding MT with community translations when volunteers or funding are available.
- Runbook at docs/i18n/crowdin-operations.md covers glossary maintenance, adding target languages, kill-switch label, debugging, and volunteer onboarding.
