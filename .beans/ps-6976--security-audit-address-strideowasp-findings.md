---
# ps-6976
title: "Security audit: address STRIDE/OWASP findings"
status: in-progress
type: task
priority: normal
created_at: 2026-03-15T08:45:52Z
updated_at: 2026-03-15T21:37:03Z
parent: ps-vtws
---

Address findings from security/260315-0835-stride-owasp-full-audit. See recommendations.md for prioritized mitigations.

## Tasks

- [ ] Commit 1: Enable PRAGMA foreign_keys in SQLite client factory
- [ ] Commit 2: Tighten keyVersion validation to >= 1
- [ ] Commit 3: Add minimum password length to derivePasswordKey
- [ ] Commit 4: Add security headers, CORS, and global error handler
- [ ] Commit 5: Add in-memory rate limiting middleware
- [ ] Create follow-up beans for deferred items
- [ ] Final verification (typecheck, lint, all tests)
