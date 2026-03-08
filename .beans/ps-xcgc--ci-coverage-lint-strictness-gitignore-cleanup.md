---
# ps-xcgc
title: CI, coverage, lint strictness, gitignore cleanup
status: completed
type: task
priority: normal
created_at: 2026-03-08T08:48:01Z
updated_at: 2026-03-08T08:51:10Z
---

Add CI workflow, test coverage docs, zero-warning lint enforcement, remove project-scope.md references, update gitignore

## Summary of Changes

- Added test coverage requirements (unit 80%, integration 70%, e2e critical paths) to CONTRIBUTING.md and project docs
- Enforced zero warnings: --max-warnings 0 on all eslint scripts (7 packages), lint-staged, hooks
- Removed project-scope.md from git tracking and added to .gitignore
- Removed all references to project-scope.md from README.md and CHANGELOG.md
- Updated .gitignore for private files
- Created .github/workflows/ci.yml with lint and typecheck jobs, plus commented stubs for unit/e2e tests
- Updated project docs with current build commands
- Created bean ps-m426 for test CI implementation
