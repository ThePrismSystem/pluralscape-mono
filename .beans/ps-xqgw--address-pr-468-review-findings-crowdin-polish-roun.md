---
# ps-xqgw
title: "Address PR #468 review findings (Crowdin polish round 2)"
status: completed
type: feature
priority: normal
created_at: 2026-04-18T21:35:19Z
updated_at: 2026-04-19T22:56:37Z
parent: ps-0enb
---

Implements docs/superpowers/specs/2026-04-18-crowdin-review-response-design.md. Addresses critical + important findings from 5-agent review of feat/crowdin-polish. 7 commits (TDD integrated): docs, context sidecars, 2-pass MT, automerge safety, Google creds, glossary/qa, refactors.

## Summary of Changes

Implements the design at `docs/superpowers/specs/2026-04-18-crowdin-review-response-design.md` across 15 commits on `feat/crowdin-polish`:

- **Docs (commits 1d3ec84e + 3316cd3b)** — ADR 036 rewritten for honest transitional posture (MT auto-approved as shipping translation until volunteers arrive); rollout plan via repo variable; softened "~1 minute" claim; runbook adds revert path, DeepL quota, secret ownership, volunteer onboarding, source-context authoring; env-var count corrected; stale SECRETS.md + "bypassed approval" phrasing fixed.
- **Source string context (commits 8814dc6b + 39877259)** — 5 sidecar `*.context.json` files with 7 authored contexts for `common.json`; zod schema; pure `diffContexts` + error-aggregating `applyContexts` with pagination and identifier-drift diagnostic; new `pnpm crowdin:upload-context` step in sync workflow; 11 tests.
- **2-pass TM + MT (commits 509b6232 + ec40567f)** — Genuine TM → DeepL MT → Google MT pipeline with `autoApproveOption: "all"` and `translateUntranslatedOnly: true`; first-failure short-circuit; ENGINE_ROUTING fixed (es→es-ES, zh-Hans→zh-CN) and keyed on TargetLanguageId; dead `--files` flag forwarded; `--languages` validated; AbortSignal-cancellable poll with listener cleanup on resolve; dry-run skips env loading; 12 tests.
- **Auto-merge safety (commit 92d9a059)** — Check-runs fetched by head SHA with `--match-head-commit` on merge; empty checks → `ci_missing`; `no_files` split from `path_outside_allowlist`; discriminated-union EvaluationResult; zod validation on all gh API responses; `--body-file` for comments; job-level `if:` guard; `CROWDIN_AUTOMERGE_DRY_RUN` repo variable defaulting true; guard script refactored to export `runGuard(deps)` for DI; 28 tests (16 evaluator + 8 guard + 4 gh).
- **Google creds (commits 5fd4cb9d + 7718066d)** — Env loader resolves `GOOGLE_APPLICATION_CREDENTIALS` file to JSON when the JSON var is absent; zod-validates service-account shape at load time; file-read errors wrapped with path context; 12 tests.
- **Glossary + QA (commits 09279c3b + bdb8bd96 + b0b10036)** — Full-payload diff (description + status + partOfSpeech); per-item try/catch with AggregateError; `TermStatus` constants; freeform pos values (`adj`, `noun/verb`) mapped to Crowdin's PartOfSpeech enum via POS_MAPPING; `applyQaChecks` uses Object.fromEntries + readback verification; 21 tests.
- **Refactors (commit ce1b7f37)** — Dropped unused `LanguageDiff.unchanged`; `--only` scope validation with loud typo rejection; scope→formatter map; sync.yml progress averages instead of summing.

Tests: 12521 unit / 2786 integration / 506 E2E passing. No new `any` / `as unknown as T` / loose Records in production code.
