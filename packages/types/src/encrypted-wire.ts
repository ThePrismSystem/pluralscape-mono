import type { EncryptedBlob } from "./encryption-primitives.js";

/**
 * Wire-form envelope for any `XServerMetadata` type. The domain carries
 * `encryptedData: EncryptedBlob` (or `| null`); on the wire that field is
 * base64 `string` (or `string | null`). Every other column passes through.
 *
 * @see docs/adr/023-zod-type-alignment.md
 *
 * Example:
 *   type MemberResult = EncryptedWire<MemberServerMetadata>;
 */
export type EncryptedWire<T extends { readonly encryptedData: EncryptedBlob | null }> = Omit<
  T,
  "encryptedData"
> & {
  // null extends T["encryptedData"] is true only when the union actually contains null.
  readonly encryptedData: null extends T["encryptedData"] ? string | null : string;
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
