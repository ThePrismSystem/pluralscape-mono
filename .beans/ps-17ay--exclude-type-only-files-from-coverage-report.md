---
# ps-17ay
title: Exclude type-only files from coverage report
status: completed
type: task
priority: normal
created_at: 2026-04-07T22:44:28Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-tdj8
---

Several type-only files are showing 0/0/0/0 in the coverage report and dragging down branch coverage numbers. They should be excluded from coverage like other type-only files.

## Summary of Changes

Excluded 13 type-only files from coverage reporting in vitest.config.ts:

- packages/types/src/friend-dashboard.ts
- packages/types/src/subscription-events.ts
- packages/crypto/src/key-storage.ts
- packages/crypto/src/blob-pipeline/blob-encryption-metadata.ts
- packages/db/src/helpers/types.ts
- packages/db/src/views/types.ts
- packages/i18n/src/types.ts
- packages/api-client/src/generated/api-types.ts (auto-generated openapi types)
- packages/sync/src/event-bus/event-map.ts
- apps/api/src/middleware/idempotency-store.ts
- apps/api/src/middleware/rate-limit-store.ts
- apps/api/src/services/hierarchy-service-types.ts

## Impact

Headline numbers unchanged (94.37/89.85/92.93/94.82 vs prior 94.38/89.86/92.93/94.82). Type-only files were already contributing 0/0 to numerator and denominator in v8 coverage (TypeScript types compile to nothing). The fix is cosmetic — cleans up the report and removes misleading 0% rows that obscured the real picture.
