---
# ps-rg1u
title: "PR #505 follow-up: classifier extraction and review hardening"
status: completed
type: task
priority: normal
created_at: 2026-04-20T01:00:38Z
updated_at: 2026-04-20T01:12:02Z
---

Follow-up to PR #505 addressing review findings from multi-agent review.

Critical/important findings:

- stderr classifier swallows ERROR logs whose msg contains literal "level":50 (line.includes bug)
- Classifier splits on data events, not lines — partial JSON across chunks gets misclassified
- stderrTail ring bounded by chunks loses diagnostics under burst stderr
- Classifier logic duplicated across api-server.ts and global-setup.ts
- Classifier has no unit coverage
- Live onExit listener never exercised (all 3 pollHealth tests use exitCode !== null seed)
- VITEST-strip regression (fixed in 703d94ac) has no assertion
- E2E_PORT redeclared in global-setup.ts
- setTimeout(r, 10) hard-sleep in poll-health.test.ts violates no-hard-sleeps
- delete spawnEnv[VITEST] mutates fresh object unnecessarily
- PollHealthOptions allows stderrTail without child (silently ignored)

## Todo

- [x] Extract createStderrClassifier helper (line-buffered, JSON.parse+level check)
- [x] Extract inheritEnvWithoutVitest helper
- [x] Narrow PollHealthOptions to discriminated union (stderrTail requires child)
- [x] Refactor api-server.ts to use helpers + line-bounded stderrTail
- [x] Refactor global-setup.ts to use helpers + import E2E_PORT
- [x] Add sub-path exports for classify-pino-stderr and api-env
- [x] Add classify-pino-stderr unit tests (JSON, embedded level, non-JSON, partial chunk)
- [x] Add api-env unit tests (VITEST stripped, other keys preserved)
- [x] Replace setTimeout hard-sleep with once(child, close) in poll-health.test.ts
- [x] Add pollHealth live-onExit test (child exits DURING loop)
- [x] Verify: typecheck, lint, unit tests
- [x] Verify: typecheck + lint + unit (12595 pass) + e2e (507 pass)

## Summary of Changes

- Extracted stateful `createStderrClassifier` helper into `tooling/test-utils/src/e2e/classify-pino-stderr.ts`. Buffers partial lines across chunks, splits on `\n` / `\r\n`, parses each line with `JSON.parse`, and only suppresses when the outer `level` field is numeric and `< 50`. Everything else — non-JSON, missing level, non-numeric level, level >= 50 — falls through to forwarding. Replaces the old regex + `line.includes('"level":50')` classifier that was (a) fooled by ERROR logs whose msg contained the literal string `"level":50`, and (b) fooled by DEBUG logs whose msg happened to contain the same substring (forced-forward). Also exposes `flush()` to emit a trailing partial line on close.
- Extracted `inheritEnvWithoutVitest` into `tooling/test-utils/src/e2e/api-env.ts`. Destructures `VITEST` out of `process.env` rather than mutating a freshly-built object, making intent self-documenting and the VITEST-strip behavior unit-testable.
- Narrowed `PollHealthOptions` to a discriminated union: `stderrTail` can only be supplied alongside `child`. Previously `stderrTail` without `child` compiled but was silently ignored.
- Line-bounded stderr tail via `STDERR_TAIL_MAX_LINES = 200`. pollHealth joins with `\n` when formatting the early-exit error message. Loses no diagnostics under bursty stderr.
- Refactored both spawn sites (`tooling/test-utils/src/e2e/api-server.ts` and `apps/api-e2e/src/global-setup.ts`) to use the shared helpers: removed duplicated classifier logic, replaced `const spawnEnv = {...}; delete spawnEnv[VITEST]` with spread of `inheritEnvWithoutVitest()`, imported `E2E_PORT` from test-utils instead of redeclaring it.
- Added sub-path exports `./e2e/api-env` and `./e2e/classify-pino-stderr` in `tooling/test-utils/package.json` to keep Playwright consumers from transitively importing `vitest/expect` through the main `/e2e` barrel (matches the pattern established in commit 1598fd3e).
- Added 15 new unit tests for the classifier: valid pino ERROR/FATAL forwarded, level:30 suppressed, embedded level:50 substring in ERROR msg still forwarded, embedded level:50 substring in DEBUG msg still suppressed (regression guard for both old bugs), non-JSON forwarded, JSON without level forwarded, non-numeric level forwarded, JSON split across chunks accumulated and emitted on completion, mixed chunk (INFO + raw error) classified per-line, prefix applied to forwarded only, empty lines skipped, flush emits trailing partial line, CRLF handled, last incomplete line buffered across process/flush boundaries.
- Added 6 new unit tests for `inheritEnvWithoutVitest` including a regression guard that `VITEST=true` in the parent never leaks to the result.
- Added live-onExit pollHealth test: child sleeps 100ms and exits DURING the poll loop, exercising the `child.on("exit", ...)` listener path (all 3 previous tests seeded from `child.exitCode !== null`, never exercising the live listener or the finally-branch `off`).
- Replaced `setTimeout(r, 10)` hard-sleep in poll-health.test.ts with `await once(child, "close")` (deterministic — fires after exit + stdio drain).

## Verification

- `pnpm typecheck` — 21/21 green
- `pnpm lint` — 17/17 green, zero warnings
- `pnpm test:unit` — 900 test files, 12595 tests pass
- `pnpm test:e2e` — 507 tests pass, 2 skipped — confirms the refactored bootstrap still works against the live API server + Docker infra
