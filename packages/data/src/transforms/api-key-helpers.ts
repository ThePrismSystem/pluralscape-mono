import { decryptApiKeyPayload } from "./api-key.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ApiKeyEncryptedPayload,
  ApiKeyId,
  ApiKeyScope,
  BucketId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

/** Shape of the tRPC apiKey.get / apiKey.list[i] row (mirrors apps/api ApiKeyResult). */
export interface ApiKeyListRow {
  readonly id: ApiKeyId;
  readonly systemId: SystemId;
  readonly keyType: "metadata" | "crypto";
  readonly scopes: readonly ApiKeyScope[];
  readonly createdAt: UnixMillis;
  readonly lastUsedAt: UnixMillis | null;
  readonly revokedAt: UnixMillis | null;
  readonly expiresAt: UnixMillis | null;
  readonly scopedBucketIds: readonly BucketId[] | null;
  readonly encryptedData: string;
}

export interface ApiKeyListRowWithPayload extends ApiKeyListRow {
  readonly payload: ApiKeyEncryptedPayload;
}

/**
 * Project an ApiKey row plus the master key into a row carrying the decoded
 * `ApiKeyEncryptedPayload`. The `encryptedData` field is always non-null on
 * the wire (the column is `.notNull()` on the server), so the decoded payload
 * is always present.
 */
export function withDecodedApiKeyPayload(
  row: ApiKeyListRow,
  masterKey: KdfMasterKey,
): ApiKeyListRowWithPayload {
  return {
    ...row,
    payload: decryptApiKeyPayload(row.encryptedData, masterKey),
  };
}
