---
# ps-ljrg
title: "Fix PR #259 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-24T06:10:13Z
updated_at: 2026-04-16T07:29:48Z
parent: ps-mmpz
---

Fix all critical/important issues and suggestions from PR review: connOpts auth options, exec error visibility, biometric_tokens RLS, filter assertions, webhook-config over-mocking, shared crypto mock, redundant mockClear, thin test assertions, bean completion.

## Summary of Changes\n\nFixed all 9 review findings from PR #259:\n1. connOpts now forwards auth/TLS/db options in bullmq adapters\n2. Test container exec() logs errors to stderr\n3. Added RLS policy for biometric_tokens (account-fk scope via sessions)\n4. Bean ps-a2d4 marked completed\n5. Filter assertions strengthened with captureWhereArg pattern\n6. webhook-config.service.test.ts reduced from 10 to 4 mocks\n7. Shared crypto mock helper extracted\n8. Redundant mockAudit.mockClear() removed\n9. Anti-enum timing and parseCheckInRecordQuery defaults tests improved
