---
# ps-pc0h
title: Consolidate Renovate dependency updates and fix audit vulnerabilities
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:00:39Z
updated_at: 2026-03-26T07:00:44Z
---

Consolidate 5 Renovate PRs into a single branch, fix pnpm audit vulnerabilities (picomatch, yaml via lint-staged), and fix flaky ioredis teardown in queue integration tests.

## Summary of Changes\n\n- Updated @aws-sdk/client-s3 + s3-request-presigner 3.1016.0 → 3.1017.0\n- Updated @electric-sql/pglite 0.4.1 → 0.4.2\n- Updated @automerge/automerge 3.2.4 → 3.2.5\n- Updated bullmq 5.71.0 → 5.71.1\n- Added picomatch (>=4.0.4) and yaml (>=2.8.3) pnpm overrides to fix 3 audit vulnerabilities\n- Fixed flaky ioredis teardown in valkey-container.ts: use disconnect() instead of quit()
