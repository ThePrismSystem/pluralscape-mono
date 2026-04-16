---
# db-soc3
title: Add deployment-mode guard to search index DB layer
status: completed
type: task
priority: high
created_at: 2026-03-13T13:30:06Z
updated_at: 2026-04-16T07:29:38Z
parent: ps-vtws
---

Dual-layer enforcement: DB functions throw when deployment mode is hosted, API middleware returns 403. Prevents plaintext search_index population on hosted/cloud deployments per ADR 018.

## Summary of Changes

Added assertSelfHosted guard to createSearchIndex, insertSearchEntry, rebuildSearchIndex functions. Created deployment.ts with getDeploymentMode(). Added 4 guard tests. Re-exported DeploymentMode from package index.
