import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { withDecodedApiKeyPayload, type ApiKeyListRow } from "../api-key-helpers.js";
import { encryptApiKeyPayload } from "../api-key.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { ApiKeyId, SystemId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeRow(encryptedData: string): ApiKeyListRow {
  return {
    id: brandId<ApiKeyId>("ak_test"),
    systemId: brandId<SystemId>("sys_test"),
    keyType: "crypto",
    scopes: ["read:members"],
    createdAt: toUnixMillis(1000),
    lastUsedAt: null,
    revokedAt: null,
    expiresAt: null,
    scopedBucketIds: null,
    encryptedData,
  };
}

describe("withDecodedApiKeyPayload", () => {
  it("decodes crypto-variant payload preserving Uint8Array publicKey", () => {
    const publicKey = new Uint8Array(32).fill(0x42);
    const { encryptedData } = encryptApiKeyPayload(
      { keyType: "crypto", name: "test crypto key", publicKey },
      masterKey,
    );
    const row = makeRow(encryptedData);

    const result = withDecodedApiKeyPayload(row, masterKey);

    expect(result.payload.keyType).toBe("crypto");
    if (result.payload.keyType === "crypto") {
      expect(result.payload.name).toBe("test crypto key");
      expect(result.payload.publicKey).toBeInstanceOf(Uint8Array);
      expect(result.payload.publicKey.length).toBe(32);
      expect(result.payload.publicKey[0]).toBe(0x42);
    }
  });

  it("decodes metadata-variant payload", () => {
    const { encryptedData } = encryptApiKeyPayload(
      { keyType: "metadata", name: "metadata key" },
      masterKey,
    );
    const row = makeRow(encryptedData);

    const result = withDecodedApiKeyPayload(row, masterKey);

    expect(result.payload.keyType).toBe("metadata");
    if (result.payload.keyType === "metadata") {
      expect(result.payload.name).toBe("metadata key");
    }
  });

  it("preserves all other row fields", () => {
    const { encryptedData } = encryptApiKeyPayload({ keyType: "metadata", name: "k" }, masterKey);
    const row = makeRow(encryptedData);

    const result = withDecodedApiKeyPayload(row, masterKey);

    expect(result.id).toBe(row.id);
    expect(result.systemId).toBe(row.systemId);
    expect(result.scopes).toEqual(row.scopes);
    expect(result.createdAt).toBe(row.createdAt);
  });
});
