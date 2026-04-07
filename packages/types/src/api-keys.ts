import type { ApiKeyId, Brand, BucketId, SystemId } from "./ids.js";
import type { ScopeDomain, ScopeTier } from "./scope-domains.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

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
