---
# db-z681
title: Refactor versionCheck boilerplate into versioned() helper
status: todo
type: task
priority: low
created_at: 2026-03-12T01:39:41Z
updated_at: 2026-03-12T01:39:41Z
---

The pattern `(t) => [check("foo_version_check", versionCheck(t.version))]` repeats 30+ times across schema files. Could be folded into the versioned() audit helper to reduce boilerplate.
