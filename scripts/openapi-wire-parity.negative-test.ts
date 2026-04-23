// scripts/openapi-wire-parity.negative-test.ts
//
// Deliberate-mismatch fixture. Proves the PlaintextX parity gate fails
// when the domain side doesn't match the OpenAPI side. Without this
// fixture, a silently-broken `Equal<>` assertion (e.g., resolving to
// `any` on one side) would pass while catching no drift.
//
// NOT compiled by `pnpm types:check-sot` — that file walks the
// `openapi-wire-parity.type-test.ts` file and asserts the monorepo
// typechecks. This fixture is invoked separately:
//
//   pnpm exec tsc --noEmit scripts/openapi-wire-parity.negative-test.ts
//
// Expected behavior: exit 0 (the `@ts-expect-error` directive consumes
// the mismatch error). If someone breaks the parity helpers so the
// mismatch no longer fails, the `@ts-expect-error` becomes unused and
// this file fails to compile loudly.

import type { components } from "../packages/api-client/src/generated/api-types.js";
import type { Equal, Member, Serialize } from "../packages/types/src/index.js";

// Deliberately wrong: include only "name" in the Pick instead of all encrypted fields.
// `Equal<>` must resolve to `false`, which makes `true` not assignable.
type _DeliberateMismatch = Equal<
  components["schemas"]["PlaintextMember"],
  Serialize<Pick<Member, "name">>
>;

// @ts-expect-error — the equality above MUST resolve to `false`. This line
// asserts `true` against the `false` type, which requires the directive.
// If the parity helpers are broken so the mismatch resolves to `true` (or
// `boolean`, or `any`), the directive becomes unused and this file fails
// to compile — alerting the developer that the gate is no longer live.
const _mustFail: _DeliberateMismatch = true;

// Silence unused-var lint — `_mustFail` exists only to trigger the
// expect-error above.
void _mustFail;
