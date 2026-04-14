---
# ps-h2gl
title: "Milestone 9: Data Import Functionality"
status: completed
type: milestone
priority: normal
created_at: 2026-03-31T23:10:26Z
updated_at: 2026-04-14T04:57:37Z
blocked_by:
  - ps-7j8n
---

Simply Plural and PluralKit data import engines, shared import-core orchestration, import API infrastructure, mobile glue, E2E test suites.

## Summary of Changes

Pulled data import forward from old M12 (Ancillary Features) as a standalone milestone. Import is data-layer work — establishing the full data surface (including imported SP and PK data) before UI/UX design begins.

### Completed Epics

- Simply Plural import (`packages/import-sp`) — 15 collection mappers (14 with full API support), file and API source modes, Zod validation, encrypted payload alignment, notes support
- PluralKit import (`packages/import-pk`) — member, group, fronting session, group membership mapping from PK JSON exports
- Import-core extraction (`packages/import-core`) — shared orchestration engine with Persister interface, checkpoint resume, entity ref tracking (ADR 034)
- Import API infrastructure — REST + tRPC routes, batch entity-ref operations, mobile glue (17 entity persisters, import hooks, avatar fetcher)
- SP seed script (`scripts/sp-seed`) + PK seed script (`scripts/pk-seed`) + E2E test infrastructure

### Key PRs

- #401: SP import API foundation
- #402: SP import engine
- #406: SP import engine + mobile glue
- #408: SP import audit + E2E infrastructure
- #409: SP import audit fixes + real-data bugs
- #410: SP import API notes support
- #412: PluralKit import + shared E2E infrastructure
- #421: PK import test revamp + zero-duration session fix

### ADRs Added

- ADR 033: PluralKit API client library selection
- ADR 034: Import-core extraction
