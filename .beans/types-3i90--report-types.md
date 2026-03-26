---
# types-3i90
title: Report types
status: todo
type: feature
created_at: 2026-03-26T16:05:58Z
updated_at: 2026-03-26T16:05:58Z
parent: client-vhga
blocked_by:
  - client-vhga
---

Define ReportType discriminated union: member-by-bucket | meet-our-system. MemberByBucketReportConfig, MeetOurSystemReportConfig. MemberByBucketReportData, MeetOurSystemReportData (client-side plaintext types after decryption). Files: packages/types/src/reports.ts (new), re-export from index.ts. Tests: type tests.
