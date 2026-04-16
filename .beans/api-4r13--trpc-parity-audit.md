---
# api-4r13
title: tRPC parity audit
status: completed
type: task
priority: normal
created_at: 2026-04-02T09:33:10Z
updated_at: 2026-04-16T07:29:50Z
parent: api-kjyg
---

Audit all 15 domains for tRPC/REST parity. Produce report at docs/local-audits/trpc-parity-audit.md and create beans for each gap found. See docs/superpowers/specs/2026-04-02-trpc-parity-audit-design.md

## Summary of Changes

Completed tRPC parity audit across all 15 domains. Report saved to docs/local-audits/trpc-parity-audit.md.

Key findings:

- 259 tRPC procedures exist, covering ~85% of REST endpoints
- 54 P0 gaps identified (missing procedures)
- 2 P1 gaps identified (missing input validation filters)
- 4 domains have complete parity (Members, Groups, Custom Fields, Blobs)
- 2 entire routers missing (Social: 19 endpoints, Webhooks: 12 endpoints)
- Systematic pattern: permanent delete procedures missing across 8 routers
- Sync (WebSocket/SSE) correctly not wrapped in tRPC

8 remediation beans created: api-l2qt, api-yvaw, api-w4rd, api-x7uh, api-gey8, api-s5s1, api-azpi, api-icgc
