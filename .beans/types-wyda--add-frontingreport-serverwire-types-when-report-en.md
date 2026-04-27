---
# types-wyda
title: Add FrontingReport server/wire types when report endpoints land
status: completed
type: task
priority: normal
created_at: 2026-04-27T19:00:11Z
updated_at: 2026-04-27T21:16:27Z
parent: ps-cd6x
---

Replace the `server: never` / `wire: never` placeholders in the SoT manifest entry for FrontingReport (`packages/types/src/__sot-manifest__.ts`) with concrete `FrontingReportServerMetadata` and `FrontingReportWire` types when the FrontingReport API endpoints are formalised.

## Background

Landed in `types-emid` (PR #579) as part of the canonical-chain extension. The manifest entry currently uses `never` placeholders with an inline JSDoc TODO explaining the deferred status. This was acceptable because:

1. The encrypted-input parity gate (Class A: `FrontingReportEncryptedInput` ≡ `Pick<FrontingReport, K>`) is the load-bearing invariant for the data-layer wiring.
2. No FrontingReport API endpoints exist yet — adding wire/server types pre-emptively would freeze design choices we don't have yet.

## Acceptance

- FrontingReport API endpoints exist (presumably under `apps/api/src/services/fronting-report/` or similar — exact location TBD by the endpoint design).
- `FrontingReportServerMetadata` defined in `packages/types/src/analytics.ts` (or moved to `packages/types/src/entities/fronting-report.ts` if the type warrants its own entity file).
- `FrontingReportWire` defined alongside.
- SoT manifest entry updated (`server: FrontingReportServerMetadata`, `wire: FrontingReportWire`).
- The inline TODO comment in the manifest is removed.
- Drizzle parity test added if a DB schema is involved.
- OpenAPI-Wire parity test added.

## Related

- types-emid (PR #579 — Class A canonical chain landed)
- ps-cd6x (Milestone 9a)

## Summary of Changes

Canonical chain added for FrontingReport in packages/types/src/analytics.ts:
FrontingReportEncryptedFields, FrontingReportEncryptedInput (now Pick-derived),
FrontingReportServerMetadata, FrontingReportResult, FrontingReportWire. The
gate that this bean was waiting on — "report endpoints land" — was already met
(routes exist under apps/api/src/routes/fronting-reports/). SoT manifest entry
updated (server/result/wire slots filled; previously never). Data-package
transform migrated to consume FrontingReportWire directly with re-branding.
Mobile consumers migrated. Closed alongside ps-etbc in the M9a types
closeout PR.
