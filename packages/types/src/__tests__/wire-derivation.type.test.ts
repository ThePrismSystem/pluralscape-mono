/**
 * G10: wire-derivation type-level gate.
 *
 * For every `SotEntityManifest` entry, the `wire` slot must be derivable
 * from the canonical chain via `Serialize<T>` — applied to one of:
 *
 *   - `result` slot, when present (Class A / encrypted entities — wire
 *     is `Serialize<EncryptedWire<<X>ServerMetadata>>`); or
 *   - `server` slot (raw Drizzle row — for plaintext entities whose
 *     wire equals the row 1:1 once `ServerInternal<…>` is stripped); or
 *   - `domain` slot (for plaintext entities whose server row carries
 *     server-only columns the API never exposes — e.g. `BlobMetadata`'s
 *     storage layout, `DeviceToken`'s `tokenHash`).
 *
 * The third form is allowed because `Serialize<>` strips brands but does
 * not drop columns not branded `ServerInternal<…>`. When the divergence
 * between `<X>` and `<X>ServerMetadata` is structural (added nullables,
 * dropped audit fields, plaintext-vs-discriminated columns) rather than
 * brand-only, the canonical-chain choice is to derive the wire from the
 * domain. Each such entity carries a JSDoc on its `<X>Wire` line citing
 * the server-row fields the wire intentionally omits.
 *
 * The gate still prevents the most common drift class: a manually
 * authored `<X>Wire` that diverges from the entire canonical chain
 * (no `Serialize<>` derivation matches). That fails the assertion below
 * and surfaces during `pnpm types:check-sot`.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { SotEntityManifest } from "../__sot-manifest__.js";
import type { Equal, Serialize } from "../type-assertions.js";

/**
 * Manifest keys whose canonical chain projects through a curated
 * `<X>ServerVisible` allowlist before `Serialize<>` (Class C with a
 * positive-Pick wire surface). The gate recognises these explicitly
 * rather than papering over the divergence; each entry below carries a
 * JSDoc on the entity file documenting why the wire is a curated
 * subset of the server row.
 */
type CuratedWireKey = "ApiKey";

/**
 * For each manifest key, derive expected wire shapes from each available
 * source (`result` if present, `server`, `domain`) and assert that the
 * declared `wire` matches at least one. Curated-wire entries are exempt
 * — their wire is a positive Pick allowlist on `<X>ServerMetadata` and
 * cannot be expressed as a single canonical `Serialize<>` step.
 *
 * The conditional walks `result` first (encrypted-entity branch), then
 * `server` (plaintext branch), and finally `domain` (server-row-diverges
 * branch). A manifest entry that derives `wire` from none of these and
 * is not on `CuratedWireKey` fails the gate.
 */
type WireDerivationCheck<K extends keyof SotEntityManifest> = K extends CuratedWireKey
  ? true
  : SotEntityManifest[K] extends { result: infer R; wire: infer W }
    ? Equal<W, Serialize<R>>
    : SotEntityManifest[K] extends { server: infer S; domain: infer D; wire: infer W }
      ? Equal<W, Serialize<S>> extends true
        ? true
        : Equal<W, Serialize<D>>
      : never;

/** Manifest keys whose wire is not derivable from any canonical source. */
type Failures = {
  [K in keyof SotEntityManifest]: WireDerivationCheck<K> extends true ? never : K;
}[keyof SotEntityManifest];

describe("G10 — wire-derivation parity", () => {
  it("every manifest entry's wire is derivable from result, server, or domain via Serialize<>", () => {
    type FailureSentinel = [Failures] extends [never] ? "ok" : Failures;
    expectTypeOf<FailureSentinel>().toEqualTypeOf<"ok">();
  });
});
