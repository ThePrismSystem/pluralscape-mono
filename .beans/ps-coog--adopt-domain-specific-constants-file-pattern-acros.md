---
# ps-coog
title: Adopt domain-specific constants file pattern across codebase
status: completed
type: task
priority: normal
created_at: 2026-03-15T20:46:00Z
updated_at: 2026-03-16T20:44:41Z
---

Establish \*.constants.ts as the standard pattern for numeric/string constants that would otherwise trigger no-magic-numbers lint warnings.

## Tasks

- [x] Document the pattern in CLAUDE.md (Code Quality section)
- [x] Document the pattern in CONTRIBUTING.md
- [x] Audit existing packages for magic number violations and migrate to \*.constants.ts files
- [x] Investigate eslint hints/suggestions to guide developers toward the pattern (e.g. custom rule or eslint-plugin-suggest)

## Pattern

Each package gets a domain-specific constants file (e.g. queue.constants.ts, sync.constants.ts). The eslint config has a file-level override that disables no-magic-numbers for \*.constants.ts files. Constants must have JSDoc comments explaining their purpose.

## Summary of Changes

- Renamed `constants.ts` to `*.constants.ts` in crypto, db, and i18n packages to match the ESLint glob override
- Created `middleware.constants.ts` consolidating HTTP status codes, CORS/HSTS durations, and rate limiter thresholds
- Added `AUDIT_LOG_DETAIL_MAX_LENGTH` and `URL_MAX_LENGTH` to db constants, replacing bare 2048 literals in schemas
- Extracted thumbnail defaults (width, height, quality) to `blob-constants.ts`
- Documented the `*.constants.ts` pattern in CLAUDE.md and CONTRIBUTING.md
- ESLint investigation: existing `warn` + `--max-warnings 0` enforcement is sufficient; custom rule not worth the maintenance cost at this stage
