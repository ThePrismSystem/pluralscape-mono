import type { ChallengeNonce } from "@pluralscape/crypto";
import type { ServerInternal } from "@pluralscape/types";

/**
 * Re-brand helpers for `ServerInternal<…>`-marked DB columns.
 *
 * `ServerInternal<T>` is `T & { [serverInternal]: true }` — it has the same
 * runtime shape as `T` plus a phantom marker that `Serialize<>` strips at
 * the wire boundary. Adjacent peer brands (`CryptoBrand`, `Brand<>`) carry
 * their own phantom markers and don't intersect with `ServerInternal<…>`,
 * so values must be re-tagged at the column boundary.
 *
 * These helpers swap brands at a single, named boundary so call sites stay
 * free of per-site type assertions. Compile-time only — no runtime cost.
 */

/**
 * Tag plain `Uint8Array` bytes as the `ServerInternal<Uint8Array>` brand a
 * Drizzle column carries. Used at insert sites where the value originates
 * from a peer-branded source (e.g. `ChallengeNonce`, `EncryptedEmailBytes`)
 * and the typed `.values({…})` overload demands the column brand.
 */
export function asInternalBytes(bytes: Uint8Array): ServerInternal<Uint8Array> {
  return bytes as ServerInternal<Uint8Array>;
}

/**
 * Drop the `ServerInternal<Uint8Array>` brand on a value read from a Drizzle
 * column, retagging it as `ChallengeNonce` so crypto helpers accept it.
 *
 * The 32-byte length invariant the `ChallengeNonce` brand encodes is
 * preserved by the schema column constraints — this helper is the trust
 * boundary at the read site.
 */
export function asChallengeNonce(bytes: Uint8Array): ChallengeNonce {
  return bytes as ChallengeNonce;
}
