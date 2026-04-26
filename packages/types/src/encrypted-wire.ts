import type { EncryptedBase64, EncryptedBlob } from "./encryption-primitives.js";
import type { ServerInternal } from "./server-internal.js";

/**
 * Wire-form envelope for any `XServerMetadata` type. The domain carries
 * `encryptedData: EncryptedBlob` (or `| null`); on the wire that field is
 * branded base64 (`EncryptedBase64` or `EncryptedBase64 | null`). Any
 * top-level field marked `ServerInternal<…>` is stripped — those fields
 * are server-fill-only and must never leave the server.
 *
 * @see docs/adr/023-zod-type-alignment.md
 *
 * Example:
 *   type MemberResult = EncryptedWire<MemberServerMetadata>;
 */
// Drops every key whose value type contains any `ServerInternal<…>` branch.
// `Extract<T[K], ServerInternal<unknown>>` finds the marked branches inside
// the value's union (e.g. `ServerInternal<string> | null`); if non-empty the
// key is server-only and must not appear on the wire.
type StripServerInternal<T> = {
  [K in keyof T as Extract<T[K], ServerInternal<unknown>> extends never ? K : never]: T[K];
};

export type EncryptedWire<T extends { readonly encryptedData: EncryptedBlob | null }> = Omit<
  StripServerInternal<T>,
  "encryptedData"
> & {
  // null extends T["encryptedData"] is true only when the union actually contains null.
  readonly encryptedData: null extends T["encryptedData"]
    ? EncryptedBase64 | null
    : EncryptedBase64;
};

/**
 * The plaintext-fields projection of a domain type. Sibling to
 * `EncryptedWire<T>`: where the wire envelope describes what leaves the
 * server, `PlaintextFields<T, K>` describes what goes *into* the T1 blob
 * before encryption. Used by per-entity encrypt/decrypt transforms in
 * `@pluralscape/data`.
 *
 * Distinct from `Plaintext<T>` in `encryption-primitives.ts`, which is a
 * nominal brand tagging a value as known-plaintext.
 */
export type PlaintextFields<T, K extends keyof T> = Pick<T, K>;
