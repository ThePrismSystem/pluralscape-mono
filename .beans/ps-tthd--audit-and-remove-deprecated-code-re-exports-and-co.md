---
# ps-tthd
title: Audit and remove deprecated code, re-exports, and compat shims
status: todo
type: task
created_at: 2026-03-15T20:47:20Z
updated_at: 2026-03-15T20:47:20Z
---

The project is pre-production with no external consumers. Scan the entire codebase for any deprecated exports, backwards-compat aliases, re-export shims, or @deprecated JSDoc tags and remove them outright.

## Tasks

- [ ] Search for @deprecated JSDoc tags across all packages
- [ ] Search for backwards-compat re-exports and alias patterns (e.g. `export const OldName = NewName`)
- [ ] Search for any compatibility shims or wrapper code that exists solely for migration
- [ ] Remove all findings and update any internal references
- [ ] Run full typecheck + lint + test suite to verify nothing breaks
