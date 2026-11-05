// scripts/openapi-wire-parity.negative-test.ts
//
// Deliberate-mismatch fixture. Proves the PlaintextX parity gate fails
// when the domain side doesn't match the OpenAPI side. Without this
// fixture, a silently-broken `Equal<>` assertion (e.g., resolving to
// `any` on one side) would pass while catching no drift.
//
// Compiled by `pnpm typecheck` as part of the root project. If someone breaks
// the parity helpers so the mismatch below no longer resolves to exactly
// `false`, the assignment at the bottom fails to compile.

import type { components } from "../packages/api-client/src/generated/api-types.js";
import type { Equal, Member, Serialize } from "../packages/types/src/index.js";

// Deliberately wrong: include only "name" in the Pick instead of all encrypted fields.
type DeliberateMismatch = Equal<
  components["schemas"]["PlaintextMember"],
  Serialize<Pick<Member, "name">>
>;

// Keeps `false` only when T is exactly `false`. `true`, `boolean`, `any`, and
// `never` all resolve to `never`, which rejects the assignment below.
type ExactlyFalse<T> = 0 extends 1 & T
  ? never
  : [T] extends [false]
    ? [false] extends [T]
      ? false
      : never
    : never;

export const deliberateMismatchIsRejected: ExactlyFalse<DeliberateMismatch> = false;
