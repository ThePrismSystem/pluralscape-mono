/**
 * E2E coverage for the ApiKey encryptedData round-trip wired in client-a0gf.
 *
 * Validates that a crypto-variant payload (`name` + 32-byte X25519 publicKey)
 * survives the encrypt-on-create → list → decrypt flow end-to-end, including
 * the Zod codec that turns `publicKey: Uint8Array` into a base64 string inside
 * the AEAD plaintext.
 */
import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { getSystemId } from "../../fixtures/entity-helpers.js";
import { HTTP_CREATED, HTTP_OK } from "../../fixtures/http.constants.js";

interface ApiKeyRow {
  id: string;
  systemId: string;
  keyType: "metadata" | "crypto";
  encryptedData: string;
}

interface CreateBody {
  data: ApiKeyRow;
}

interface ListBody {
  data: ApiKeyRow[];
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToUint8Array(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

test.describe("ApiKey encryptedData round-trip", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("crypto-variant publicKey survives encrypt-on-create → list → decrypt", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const keysUrl = `/v1/systems/${systemId}/api-keys`;

    const publicKey = new Uint8Array(32).fill(0xaa);
    const wirePayload = {
      keyType: "crypto" as const,
      name: "Crypto Round-Trip Key",
      publicKey: uint8ArrayToBase64(publicKey),
    };
    const encryptedData = encryptForApi(wirePayload);

    const createRes = await request.post(keysUrl, {
      headers: authHeaders,
      data: {
        keyType: "crypto",
        scopes: ["read:members"],
        encryptedData,
        encryptedKeyMaterial: uint8ArrayToBase64(new Uint8Array(64).fill(0xbb)),
      },
    });
    expect(createRes.status()).toBe(HTTP_CREATED);
    const createBody = (await createRes.json()) as CreateBody;
    const created = createBody.data;
    expect(created.encryptedData).toBeTruthy();
    expect(typeof created.encryptedData).toBe("string");

    const listRes = await request.get(keysUrl, { headers: authHeaders });
    expect(listRes.status()).toBe(HTTP_OK);
    const listBody = (await listRes.json()) as ListBody;
    const row = listBody.data.find((k) => k.id === created.id);
    expect(row).toBeDefined();
    expect(row?.encryptedData).toBeTruthy();

    const decoded = decryptFromApi(row?.encryptedData ?? "") as {
      keyType: string;
      name: string;
      publicKey: string;
    };
    expect(decoded.keyType).toBe("crypto");
    expect(decoded.name).toBe("Crypto Round-Trip Key");
    const decodedPublicKey = base64ToUint8Array(decoded.publicKey);
    expect(decodedPublicKey.length).toBe(32);
    expect(decodedPublicKey[0]).toBe(0xaa);
  });
});
