/**
 * Re-export of `JobPayload` from `@pluralscape/types` for drizzle's
 * `$type<>()` binding on the `jobs.payload` column.
 *
 * The single source of truth lives in `packages/types/src/jobs.ts` alongside
 * `JobPayloadMap` and `JobDefinition`. Prefer importing from
 * `@pluralscape/types` directly in new code.
 */

export type { JobPayload } from "@pluralscape/types";
