import type { EncryptedBlob, T3EncryptedBytes } from "../encryption-primitives.js";
import type { AccountId, ApiKeyId, Brand, BucketId, SystemId } from "../ids.js";
import type { ScopeDomain, ScopeTier } from "../scope-domains.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { AuditMetadata } from "../utility.js";

/** A branded API key token — prevents accidental logging. */
export type ApiKeyToken = Brand<string, "ApiKeyToken">;

/** Prefix for API key tokens to distinguish them from session tokens. */
export const API_KEY_TOKEN_PREFIX = "ps_";

/** Scopes an API key can be granted. */
export type ApiKeyScope =
  | `${ScopeTier}:${ScopeDomain}`
  | "read:audit-log"
  | "read-all"
  | "write-all"
  | "delete-all"
  | "full";

/** A metadata-only API key (no crypto key material). */
export interface MetadataApiKey extends AuditMetadata {
  readonly id: ApiKeyId;
  readonly systemId: SystemId;
  readonly keyType: "metadata";
  readonly name: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly expiresAt: UnixMillis | null;
  readonly lastUsedAt: UnixMillis | null;
  readonly revoked: boolean;
}

/** A crypto-capable API key (carries key material for E2E operations). */
export interface CryptoApiKey extends AuditMetadata {
  readonly id: ApiKeyId;
  readonly systemId: SystemId;
  readonly keyType: "crypto";
  readonly name: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly expiresAt: UnixMillis | null;
  readonly lastUsedAt: UnixMillis | null;
  readonly revoked: boolean;
  readonly publicKey: Uint8Array;
  /** Restrict key to specific privacy buckets. Null = all buckets the scopes permit. */
  readonly scopedBucketIds: readonly BucketId[] | null;
}

/** Discriminated union of API key types. */
export type ApiKey = MetadataApiKey | CryptoApiKey;

/** An API key with its secret token — only returned at creation time. */
export interface ApiKeyWithSecret {
  readonly key: ApiKey;
  readonly token: ApiKeyToken;
}

/**
 * The decrypted content of an ApiKey row's `encryptedData` blob.
 *
 * Class C auxiliary type per ADR-023 — the SoT manifest's `encryptedInput`
 * slot for `ApiKey` points at this type directly (no alias).
 * Parity gate: `ApiKeyEncryptedPayloadSchema` in `packages/validation/src/api-key.ts`.
 */
export type ApiKeyEncryptedPayload =
  | { readonly keyType: "metadata"; readonly name: string }
  | { readonly keyType: "crypto"; readonly name: string; readonly publicKey: Uint8Array };

/**
 * Server-visible ApiKey metadata — raw Drizzle row shape.
 *
 * The domain `ApiKey` type is a discriminated union (metadata vs crypto)
 * plus AuditMetadata fields that live in the encrypted blob or are not
 * stored server-side. The DB row is a flat record: fields like `name` and
 * `publicKey` are bundled inside `encryptedData`; `updatedAt`/`version`
 * from AuditMetadata are not tracked on `api_keys`; and `revoked: boolean`
 * in the domain becomes a nullable `revokedAt` timestamp server-side.
 */
export interface ApiKeyServerMetadata {
  readonly id: ApiKeyId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly keyType: ApiKey["keyType"];
  readonly tokenHash: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly encryptedData: EncryptedBlob;
  /**
   * Server-side T3-encrypted private key material for `keyType === "crypto"`
   * rows. Encrypted with a server-held key (not E2E) — clients never see it.
   *
   * Class E exception per ADR-023 — the canonical chain does not extend
   * here. `ApiKey` is a hybrid Class C + Class E entity: `encryptedData`
   * follows Class C (above), `encryptedKeyMaterial` is documented as Class E.
   */
  readonly encryptedKeyMaterial: T3EncryptedBytes | null;
  readonly createdAt: UnixMillis;
  readonly lastUsedAt: UnixMillis | null;
  readonly revokedAt: UnixMillis | null;
  readonly expiresAt: UnixMillis | null;
  readonly scopedBucketIds: readonly BucketId[] | null;
}

/**
 * Server-visible plaintext fields of an ApiKey row — the columns the
 * server can surface without decrypting `encryptedData`.
 *
 * Expressed as a positive allowlist (`Pick`) so a future column added
 * to `ApiKeyServerMetadata` defaults to **excluded** from the wire
 * surface. This is fail-closed: a new sensitive column cannot leak
 * by accident.
 */
export type ApiKeyServerVisible = Pick<
  ApiKeyServerMetadata,
  | "id"
  | "systemId"
  | "keyType"
  | "scopes"
  | "createdAt"
  | "lastUsedAt"
  | "revokedAt"
  | "expiresAt"
  | "scopedBucketIds"
>;

/**
 * JSON-wire representation of an ApiKey row — the plaintext columns the
 * server can publish without decrypting `encryptedData`.
 *
 * **Wire shape rationale (Class C):** Pluralscape is zero-knowledge — the
 * server cannot decrypt the `ApiKeyEncryptedPayload` (`name` plus, for
 * `keyType === "crypto"`, `publicKey`) inside `encryptedData`. The
 * `listApiKeys` / `getApiKey` handlers in
 * `apps/api/src/services/api-key/queries.ts` project to `ApiKeyResult`
 * (`apps/api/src/services/api-key/internal.ts`). The `createApiKey`
 * handler augments that shape with the plaintext `token` once at creation
 * as `ApiKeyCreateResult` (`apps/api/src/services/api-key/create.ts`).
 *
 * `Serialize<T>` strips brands: branded IDs → `string`, `UnixMillis` → `number`.
 */
export type ApiKeyWire = Serialize<ApiKeyServerVisible>;
