---
# ps-m426
title: Add test coverage CI enforcement
status: scrapped
type: task
priority: normal
created_at: 2026-03-08T08:47:59Z
updated_at: 2026-04-16T07:29:41Z
parent: ps-jvnm
---

Add actual test runner CI jobs (unit via vitest, integration, e2e via playwright) with coverage thresholds once testing framework is set up. Stubs exist in CI workflow.

## Reasons for Scrapping

Duplicate of ps-mv06 (Coverage configuration), which is properly parented under ps-jvnm (Test framework setup) with full scope, acceptance criteria, and dependency chain. This bean was created before the M1 epic hierarchy was established.
