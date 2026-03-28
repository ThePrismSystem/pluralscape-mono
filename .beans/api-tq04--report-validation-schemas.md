---
# api-tq04
title: Report validation schemas
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:05:58Z
updated_at: 2026-03-28T18:39:20Z
parent: client-vhga
---

Create Zod schemas: GenerateReportBodySchema as a discriminated union on reportType -- "member-by-bucket" requires bucketId (UUID), "meet-our-system" requires no extra fields; both share optional title (max 200 chars) and optional locale (string). Files: packages/validation/src/report.ts (new), re-export from index.ts. Tests: unit tests covering valid input for each report type, boundary cases (unknown report type, missing bucketId for member-by-bucket, title at exactly 200 chars, empty title string, title at 201 chars), and invalid input (missing reportType, non-UUID bucketId, invalid locale format).

## Summary of Changes

- Created `packages/validation/src/report.ts` with two schemas
- `GenerateReportBodySchema`: discriminated union on `reportType` for member-by-bucket (requires bkt\_ prefixed UUID) and meet-our-system
- `BucketExportQuerySchema`: query params with entityType enum, optional cursor, limit with defaults (50) and max (100)
- Constants: `MAX_REPORT_TITLE_LENGTH`, `BUCKET_EXPORT_DEFAULT_LIMIT`, `BUCKET_EXPORT_MAX_LIMIT`
- Re-exported from `packages/validation/src/index.ts`
- Full test coverage in `packages/validation/src/__tests__/report.test.ts`
