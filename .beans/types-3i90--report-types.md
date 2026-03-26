---
# types-3i90
title: Report types
status: todo
type: feature
created_at: 2026-03-26T16:05:58Z
updated_at: 2026-03-26T16:05:58Z
parent: client-vhga
---

Define ReportType discriminated union: member-by-bucket | meet-our-system. MemberByBucketReportConfig, MeetOurSystemReportConfig. MemberByBucketReportData, MeetOurSystemReportData (client-side plaintext types after decryption). Files: packages/types/src/reports.ts (new), re-export from index.ts. Tests: compile-time type assertions using vitest `expectTypeOf` to verify ReportType discriminated union narrows correctly, config/data type pairing (MemberByBucketReportConfig pairs with MemberByBucketReportData), and required vs optional fields. Runtime exhaustive-switch tests on report type discriminant.
