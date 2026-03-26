---
# api-tq04
title: Report validation schemas
status: todo
type: feature
created_at: 2026-03-26T16:05:58Z
updated_at: 2026-03-26T16:05:58Z
parent: client-vhga
---

Create Zod schemas: GenerateReportBodySchema as a discriminated union on reportType -- "member-by-bucket" requires bucketId (UUID), "meet-our-system" requires no extra fields; both share optional title (max 200 chars) and optional locale (string). Files: packages/validation/src/report.ts (new), re-export from index.ts. Tests: unit tests covering valid input for each report type, boundary cases (unknown report type, missing bucketId for member-by-bucket, title at exactly 200 chars, empty title string, title at 201 chars), and invalid input (missing reportType, non-UUID bucketId, invalid locale format).
