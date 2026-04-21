---
# ps-lg9y
title: CI/pre-commit LOC cap on apps/api/src/services/**/*.ts
status: todo
type: task
created_at: 2026-04-21T13:59:06Z
updated_at: 2026-04-21T13:59:06Z
parent: ps-0vwf
---

Add an enforcement cap (500 LOC soft) on new service files under apps/api/src/services/ to prevent god-file regression once the refactor epic lands.

## Context

The service refactor epic (api-6l1q) splits 15 existing god-files into per-verb ≤300 LOC files. Without an enforcement mechanism, the same pattern will re-accumulate. ESLint max-lines can block this at lint time, and the pre-commit hook enforces lint with --max-warnings 0 already.

## Scope

- [ ] Add an ESLint override in tooling/eslint-config or apps/api's eslint.config.js for the apps/api/src/services/\*_/_.ts glob that sets max-lines: ["error", { max: 500, skipBlankLines: true, skipComments: true }]
- [ ] Document the cap in CLAUDE.md under "Adding API Endpoints" or a new "Service file size" subsection
- [ ] Ensure existing refactored services pass the cap (target is ≤300 LOC per file; 500 is the safety margin)
- [ ] Verify pnpm lint flags a file exceeding the cap

## Out of scope

- Cap on other directories (validators, hooks, etc.) — separate judgment call
- Hard cap on total LOC — only per-file

## Acceptance

- pnpm lint passes cleanly on main
- Adding a deliberate 501-line file under apps/api/src/services/ causes pnpm lint to fail
- No override comments (`// eslint-disable-next-line max-lines`) introduced

## Blocks

This task must land AFTER the 15 service refactor beans (api-trlq + siblings) complete, otherwise it would block itself on existing files. Add a soft dependency hint in the bean body so it's scheduled last.
