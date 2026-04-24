import type { EncryptedBlob } from "./encryption-primitives.js";

/**
 * Wire-form envelope for any `XServerMetadata` type.
 *
 * Server metadata rows carry `encryptedData: EncryptedBlob`, a structured
 * discriminated union that cannot travel over JSON. The API layer base64-
 * encodes the blob before serializing, so the wire-visible shape swaps
 * `EncryptedBlob` (or `EncryptedBlob | null`) for `string` (or `string | null`).
 *
 * Collapsing every service's `XxxResult` interface to
 * `type XxxResult = EncryptedWire<XxxServerMetadata>` keeps the derivation
 * structural so rows and wire shapes cannot drift apart. The OpenAPI parity
 * test (`scripts/openapi-wire-parity.type-test.ts`) pins the envelope shape
 * against `components["schemas"]["EncryptedEntity"]`.
 *
 * Example:
 *   type MemberResult = EncryptedWire<MemberServerMetadata>;
 */
export type EncryptedWire<
  T extends
    | { readonly encryptedData: EncryptedBlob }
    | { readonly encryptedData: EncryptedBlob | null },
> = Omit<T, "encryptedData"> & {
  // Preserve nullability from T. `null extends T["encryptedData"]` is true only
  // when T's encryptedData is `EncryptedBlob | null`, not when it's just
  // `EncryptedBlob` — the opposite direction (`X extends Y | null`) would be
  // vacuously true for the non-null case because of subtype assignability.
  readonly encryptedData: null extends T["encryptedData"] ? string | null : string;
};
