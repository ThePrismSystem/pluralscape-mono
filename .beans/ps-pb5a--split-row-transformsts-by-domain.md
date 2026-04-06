---
# ps-pb5a
title: Split row-transforms.ts by domain
status: completed
type: task
priority: normal
created_at: 2026-04-06T00:52:54Z
updated_at: 2026-04-06T05:08:09Z
parent: ps-y621
---

apps/mobile/src/data/row-transforms.ts is 1,523 lines with 37 exported functions in a single file.

Split into domain-specific files: row-transforms/identity.ts, row-transforms/fronting.ts, row-transforms/communication.ts, etc. with barrel index.

Audit ref: Pass 6 HIGH

## Summary of Changes\n\nSplit 1523-line row-transforms.ts into 10 domain modules under row-transforms/ directory with barrel index.
