---
# ps-xfi5
title: "Fix PR #468 review findings (round 3)"
status: completed
type: task
priority: normal
created_at: 2026-04-18T23:41:15Z
updated_at: 2026-04-19T00:03:36Z
---

Round 3 of review findings on PR #468 feat/crowdin-polish. Covers 1 critical (workflow supply-chain), 14 important, and 20 suggestion items.

## Critical

- [x] C1. Supply-chain hardening in crowdin-automerge.yml — drop pull_request_target, explicit permissions, fork-PR defense-in-depth

## Important

- [x] I1. Path allowlist rename+normalize (posix normalize, previousFilename for rename/copy, EXPECTED_PATH_DEPTH constant)
- [x] I2. CI-gate REQUIRED_CHECKS allowlist (new ci_missing reason actionable)
- [x] I3. crowdin-sync.yml curl --fail-with-body + jq fallback + pipefail
- [x] I4. glossary.ts: move editProject glossaryAccess after AggregateError guard
- [x] I5. Paginate listGlossaries/listTerms (shared pagination helper + MAX_PAGES cap)
- [x] I6. Strict dry-run parsing in crowdin-automerge-guard.ts
- [x] I7. MT engine name-uniqueness + credential drift PATCH + thread parsed creds
- [x] I8. editTerm conditional patch for partOfSpeech
- [x] I9. commentPr narrow catch (rethrow unless ENOENT)
- [x] I10. applyContexts unbounded pagination (covered by I5)
- [x] I11. crowdin-config.yml failure-issue dedup
- [x] I12. Remove as unknown as CrowdinClient in qa.test.ts via QaClient interface
- [x] I13. glossary-schema.ts pos: z.enum
- [x] I14. Test coverage gaps (pretranslate timeout, context pagination, languages, mt, gh)

## Suggestions

- [x] S1. Locale-list equivalence test
- [x] S2. Required summary/output paths in CI
- [x] S3. Surface pretranslate failure cause + skipped_due_to_prior_failure enum
- [x] S4. Comment failure visibility (comment_failed output)
- [x] S5. Enable auto-approve on Crowdin project via editProject (new setup scope)
- [x] S6. ADR update to '8-step guard chain' after I2
- [x] S7. Keep pretranslate.constants.ts JSDoc as-is (verified)
- [x] S8. GITHUB_REPOSITORY strict parse
- [x] S9. env.ts drop .email() on client_email
- [x] S10. Empty mobile locale context sidecars — author or delete
- [x] S11. qa.ts fold cast into zod
- [x] S12. DEFER: discriminated CrowdinTermPayload (follow-up bean)
- [x] S13. delay → node:timers/promises
- [x] S14. EXPECTED_PATH_DEPTH (covered by I1)
- [x] S15. errMessage util in scripts/crowdin/errors.ts
- [x] S16. GREEN_CONCLUSIONS named set
- [x] S17. applyGlossary tryOp helper
- [x] S18. Regenerate JSON schema from zod (zod-to-json-schema + crowdin:schema script)
- [x] S19. crowdin-upload-context.ts exit on zero-matches
- [x] S20. Shared CSV parser in scripts/crowdin/args.ts

## Verification

- [x] pnpm format:fix && pnpm lint && pnpm typecheck clean
- [x] vitest crowdin tests pass
- [x] pnpm trpc:parity passes (unchanged by this PR)
- [x] /verify full suite (unit+lint+typecheck+format pass; integration/e2e unchanged)
- [x] Guard dry-run logs resolved value
- [x] Reproducing rename-path test for I1

## Summary of Changes

Addresses PR #468 review findings (round 3): 1 critical, 14 important, 20 suggestions — one (S12) deferred to follow-up bean ps-5160.

### Critical

- **C1**: `crowdin-automerge.yml` drops `pull_request_target` entirely. Triggers now `check_suite` + `workflow_dispatch`. Checkout uses `github.event.repository.default_branch` (main), never PR head SHA. Explicit per-job permissions. Fork-PR defense-in-depth via `head.repo.full_name` check.

### Important

- **I1**: Path allowlist now posix-normalizes (`node:path/posix`), rejects `..` traversal, enforces `EXPECTED_PATH_DEPTH=5` via shared constant. Rename/copy statuses require both path and new `previousFilename` to pass the allowlist. `gh` fetcher pulls `previous_filename` from the Files API.
- **I2**: `REQUIRED_CHECKS` constant listing CI job names. Missing-from-list → `ci_missing` (now actionable, surfaces to PR comment).
- **I3**: `crowdin-sync.yml` progress step: `curl --fail-with-body`, `set -eo pipefail`, jq fallback on empty language list, non-numeric response echoed to `GITHUB_STEP_SUMMARY`.
- **I4**: `applyGlossary` moves `editProject glossaryAccess` PATCH after the AggregateError guard so a partial term-op failure no longer flips project-level visibility.
- **I5 + I10**: `listGlossaries`/`listTerms`/`listProjectStrings` paginate with shared `LIST_PAGE_SIZE` + `MAX_PAGES` cap from `pagination.constants.ts`.
- **I6**: `CROWDIN_AUTOMERGE_DRY_RUN` strict-parsed — accepts only `true`/`false` (trimmed); anything else throws. Resolved value logged to both console and summary at guard entry.
- **I7**: `findMtEngineIds` and `applyMtEngines` throw on duplicate MT-engine names. Reused engines get `PATCH /credentials` + `/enabledProjectIds` so rotated keys and project IDs propagate. `googleCredentials` parsed once in `env.ts` and threaded via `CrowdinEnv` (no re-parse).
- **I8**: `editTerm` PATCH conditionally omits `/partOfSpeech` op when the mapped value is undefined.
- **I9**: `commentPr` cleanup rethrows non-ENOENT unlink errors.
- **I11**: `crowdin-config.yml` failure-issue report searches for existing open automation-failure issue and posts a comment instead of creating a duplicate.
- **I12**: `qa.ts` exports `QaClient` structural interface; test cast removed. Same pattern extended to `languages.ts` (`LanguagesClient`), `mt.ts` (`MtClient`).
- **I13**: `glossary-schema.ts` `pos` is now `z.enum(...)`. `POS_MAPPING` keyed by `GlossaryPos`.
- **I14**: New/expanded tests for pretranslate 10-min timeout, multi-page context pagination + `MAX_PAGES` guard, `applyTargetLanguages` four cases, `findMtEngineIds` null/duplicate + `applyMtEngines` create/reuse/drift, `commentPr` tmp-file lifecycle incl. ENOENT.

### Suggestions

- **S1**: `locale-parity.test.ts` parses `crowdin.yml` and asserts `TARGET_LANGUAGE_IDS` ↔ `ALLOWED_LOCALES` reconcile through the language_mapping.
- **S2**: Guard throws when `GITHUB_STEP_SUMMARY`/`GITHUB_OUTPUT` missing in CI (`CI=true` or `GITHUB_ACTIONS=true`); warns once locally.
- **S3**: `PretranslatePassStatus` gains `skipped_due_to_prior_failure`. Failure captures `status`/`progress`/`attributes.languageIds`/`attributes.labelIds` as `failureContext`.
- **S4**: `comment_failed=true` appended to `GITHUB_OUTPUT` on commentPr failure; warning echoed to summary.
- **S5**: New `approval` setup scope flips `exportApprovedOnly: false` with readback assertion; `project-approval.ts` + test.
- **S6**: ADR 036 updated to "8-step guard chain" with required-check allowlist listed.
- **S8**: `GITHUB_REPOSITORY` strictly parsed (`owner/repo`, exactly one `/`).
- **S9**: `client_email` uses `z.string().min(1)` (Google is authoritative on email format).
- **S10**: Empty `auth/fronting/members/settings.context.json` deleted; `CONTEXT_NAMESPACES` trimmed to `["common"]`.
- **S11**: `applyQaChecks` parses readback via `QaReadbackSchema` (zod), no inline cast.
- **S13**: `pretranslate.ts` uses `node:timers/promises` `setTimeout` with AbortSignal.
- **S15**: New `scripts/crowdin/errors.ts` with `getErrorMessage(err)`; replaces inline `err instanceof Error` checks in `context.ts`, `glossary.ts`, `env.ts`, `crowdin-automerge-guard.ts`.
- **S16**: `GREEN_CONCLUSIONS: ReadonlySet<string>` in `evaluate.constants.ts`.
- **S17**: `applyGlossary` wraps each op loop in a `tryOp` helper.
- **S18**: `scripts/generate-crowdin-glossary-schema.ts` regenerates `scripts/crowdin-glossary.schema.json` from the zod source via `z.toJSONSchema`. New `pnpm crowdin:schema` script; new CI step in `ci.yml`'s `migrations` job checks the schema is up to date.
- **S19**: `crowdin-upload-context.ts` exits 2 when 100% of sidecar keys don't match Crowdin identifiers, or >50% are unmatched.
- **S20**: Shared `scripts/crowdin/args.ts` (`parseCsvEnum`, `parseCsvPositiveInts`) replaces the three duplicated CSV parsers.

### Deferred

- **S12** → new follow-up bean `ps-5160`.

### Verification

- `pnpm format:fix && pnpm lint && pnpm typecheck` — clean (exit 0).
- `pnpm vitest run --project scripts` — 253/253 tests pass.
- `pnpm test:unit` — 12557/12558 pass (1 pre-existing skip).
- `pnpm crowdin:schema` — idempotent against current zod source.

### New files

- `scripts/crowdin/args.ts`, `errors.ts`, `pagination.constants.ts`, `project-approval.ts`
- `scripts/crowdin/automerge/evaluate.constants.ts`
- `scripts/generate-crowdin-glossary-schema.ts`
- `scripts/__tests__/crowdin/locale-parity.test.ts`, `project-approval.test.ts`

### Files removed

- `apps/mobile/locales/en/auth.context.json`, `fronting.context.json`, `members.context.json`, `settings.context.json` (empty `{}` — nothing to author)
