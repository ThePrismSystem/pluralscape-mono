---
# types-3i90
title: Report types
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:05:58Z
updated_at: 2026-03-28T18:37:53Z
parent: client-vhga
---

Define ReportType discriminated union: member-by-bucket | meet-our-system. MemberByBucketReportConfig, MeetOurSystemReportConfig. MemberByBucketReportData, MeetOurSystemReportData (client-side plaintext types after decryption). Files: packages/types/src/reports.ts (new), re-export from index.ts. Tests: compile-time type assertions using vitest `expectTypeOf` to verify ReportType discriminated union narrows correctly, config/data type pairing (MemberByBucketReportConfig pairs with MemberByBucketReportData), and required vs optional fields. Runtime exhaustive-switch tests on report type discriminant.

## Summary of Changes

- Created `packages/types/src/reports.ts` with all report domain types
- `ReportType` discriminant (`member-by-bucket` | `meet-our-system`) with runtime array and type guard
- `ReportConfig` discriminated union for client-to-server report initiation
- `ReportEntitySet` mapped type keyed by `BucketContentEntityType`
- `ReportData` discriminated union for client-side decrypted report content
- `BucketExportManifestEntry`, `BucketExportManifestResponse`, `BucketExportEntity`, `BucketExportPageResponse` API types
- Re-exported all types from `packages/types/src/index.ts`
- Full type test coverage in `packages/types/src/__tests__/reports.test.ts`
