import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgApiKeysTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { ALL_API_KEY_SCOPES, brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createApiKey,
  getApiKey,
  listApiKeys,
  revokeApiKey,
  validateApiKey,
} from "../../services/api-key.service.js";
import {
  asDb,
  assertApiError,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, ApiKeyId, ApiKeyScope, SystemId } from "@pluralscape/types";

/** Shape of the params accepted by createApiKey (matches CreateApiKeyBodySchema input). */
interface CreateApiKeyTestParams {
  keyType: "metadata" | "crypto";
  scopes: ApiKeyScope[];
  encryptedData: string;
  encryptedKeyMaterial?: string;
  expiresAt?: number;
  scopedBucketIds?: string[];
}

function makeCreateParams(
  scopes: readonly ApiKeyScope[],
  overrides: Partial<CreateApiKeyTestParams> = {},
) {
  return {
    keyType: "metadata" as const,
    scopes: [...scopes],
    encryptedData: testEncryptedDataBase64(),
    ...overrides,
  };
}

describe("api-key.service (PGlite integration)", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgApiKeysTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  // ── Single scope per tier ─────────────────────────────────────

  it("creates key with a single read scope", async () => {
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["read:members"]),
      auth,
      noopAudit,
    );
    expect(result.scopes).toEqual(["read:members"]);
    expect(result.token).toMatch(/^ps_/);
  });

  it("creates key with a single write scope", async () => {
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["write:groups"]),
      auth,
      noopAudit,
    );
    expect(result.scopes).toEqual(["write:groups"]);
  });

  it("creates key with a single delete scope", async () => {
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["delete:blobs"]),
      auth,
      noopAudit,
    );
    expect(result.scopes).toEqual(["delete:blobs"]);
  });

  // ── Aggregate and special scopes ───────────────────────────────

  it("creates key with read-all aggregate scope", async () => {
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["read-all"]),
      auth,
      noopAudit,
    );
    expect(result.scopes).toEqual(["read-all"]);
  });

  it("creates key with write-all aggregate scope", async () => {
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["write-all"]),
      auth,
      noopAudit,
    );
    expect(result.scopes).toEqual(["write-all"]);
  });

  it("creates key with delete-all aggregate scope", async () => {
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["delete-all"]),
      auth,
      noopAudit,
    );
    expect(result.scopes).toEqual(["delete-all"]);
  });

  it("creates key with full scope", async () => {
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["full"]),
      auth,
      noopAudit,
    );
    expect(result.scopes).toEqual(["full"]);
  });

  // ── All scopes at once ──────────────────────────────────────────

  it("creates key with all 68 scopes", async () => {
    const allScopes = [...ALL_API_KEY_SCOPES];
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(allScopes),
      auth,
      noopAudit,
    );
    expect(result.scopes).toHaveLength(ALL_API_KEY_SCOPES.length);
    expect(new Set(result.scopes)).toEqual(new Set(allScopes));
  });

  // ── Scopes persist through get and list ────────────────────────

  it("returns matching scopes from get", async () => {
    const scopes: ApiKeyScope[] = ["read:members", "write:fronting", "delete:groups"];
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(scopes),
      auth,
      noopAudit,
    );
    const fetched = await getApiKey(asDb(db), systemId, created.id, auth);
    expect(fetched.scopes).toEqual(scopes);
  });

  it("returns matching scopes from list", async () => {
    const scopes: ApiKeyScope[] = ["read:audit-log", "write-all"];
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(scopes),
      auth,
      noopAudit,
    );
    const listed = await listApiKeys(asDb(db), systemId, auth);
    const match = listed.data.find((k) => k.id === created.id);
    expect(match?.scopes).toEqual(scopes);
  });

  // ── Validation rejections ─────────────────────────────────────

  it("rejects invalid scope string", async () => {
    await expect(
      createApiKey(
        asDb(db),
        systemId,
        makeCreateParams(["banana" as ApiKeyScope]),
        auth,
        noopAudit,
      ),
    ).rejects.toThrow("Invalid payload");
  });

  it("rejects empty scopes array", async () => {
    await expect(
      createApiKey(asDb(db), systemId, makeCreateParams([]), auth, noopAudit),
    ).rejects.toThrow("Invalid payload");
  });

  it("rejects missing scopes field", async () => {
    const params = {
      keyType: "metadata" as const,
      encryptedData: testEncryptedDataBase64(),
    };
    await expect(createApiKey(asDb(db), systemId, params, auth, noopAudit)).rejects.toThrow(
      "Invalid payload",
    );
  });

  // ── Key type validation (crypto) ──────────────────────────────

  it("creates crypto key with encryptedKeyMaterial", async () => {
    const keyMaterial = Buffer.from("test-key-material").toString("base64");
    const result = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["read:members"], {
        keyType: "crypto",
        encryptedKeyMaterial: keyMaterial,
      }),
      auth,
      noopAudit,
    );
    expect(result.keyType).toBe("crypto");
    expect(result.scopes).toEqual(["read:members"]);
  });

  it("rejects crypto key without encryptedKeyMaterial", async () => {
    await expect(
      createApiKey(
        asDb(db),
        systemId,
        makeCreateParams(["read:members"], { keyType: "crypto" }),
        auth,
        noopAudit,
      ),
    ).rejects.toThrow("Invalid payload");
  });

  it("rejects metadata key with encryptedKeyMaterial", async () => {
    const keyMaterial = Buffer.from("test-key-material").toString("base64");
    await expect(
      createApiKey(
        asDb(db),
        systemId,
        makeCreateParams(["read:members"], { encryptedKeyMaterial: keyMaterial }),
        auth,
        noopAudit,
      ),
    ).rejects.toThrow("Invalid payload");
  });

  // ── Revocation ────────────────────────────────────────────────

  it("revokes a key and writes audit event", async () => {
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["read:members"]),
      auth,
      noopAudit,
    );
    const audit = spyAudit();
    await revokeApiKey(asDb(db), systemId, created.id, auth, audit);

    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.eventType).toBe("api-key.revoked");

    const fetched = await getApiKey(asDb(db), systemId, created.id, auth);
    expect(fetched.revokedAt).not.toBeNull();
  });

  it("revoke is idempotent for already-revoked key", async () => {
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["read:members"]),
      auth,
      noopAudit,
    );
    await revokeApiKey(asDb(db), systemId, created.id, auth, noopAudit);

    const audit = spyAudit();
    await revokeApiKey(asDb(db), systemId, created.id, auth, audit);
    // No audit event written for idempotent revoke
    expect(audit.calls).toHaveLength(0);
  });

  it("revoke throws NOT_FOUND for non-existent key", async () => {
    const fakeId = brandId<ApiKeyId>("ak_00000000-0000-0000-0000-000000000000");
    await assertApiError(
      revokeApiKey(asDb(db), systemId, fakeId, auth, noopAudit),
      "NOT_FOUND",
      404,
    );
  });

  it("revoked keys are excluded from list by default", async () => {
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["delete:timers"]),
      auth,
      noopAudit,
    );
    await revokeApiKey(asDb(db), systemId, created.id, auth, noopAudit);

    const listed = await listApiKeys(asDb(db), systemId, auth);
    expect(listed.data.find((k) => k.id === created.id)).toBeUndefined();
  });

  it("revoked keys are included in list with includeRevoked", async () => {
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["delete:polls"]),
      auth,
      noopAudit,
    );
    await revokeApiKey(asDb(db), systemId, created.id, auth, noopAudit);

    const listed = await listApiKeys(asDb(db), systemId, auth, { includeRevoked: true });
    const match = listed.data.find((k) => k.id === created.id);
    expect(match?.revokedAt).not.toBeNull();
  });

  // ── Token validation ──────────────────────────────────────────

  it("validates a valid token and returns correct data", async () => {
    const scopes: ApiKeyScope[] = ["read:members", "write:fronting"];
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(scopes),
      auth,
      noopAudit,
    );

    const result = await validateApiKey(asDb(db), created.token);
    expect(result).not.toBeNull();
    if (result === null) return; // narrowing for lint
    expect(result.accountId).toBe(accountId);
    expect(result.systemId).toBe(systemId);
    expect(result.scopes).toEqual(scopes);
    expect(result.keyId).toBe(created.id);
  });

  it("returns null for a revoked token", async () => {
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["read:groups"]),
      auth,
      noopAudit,
    );
    await revokeApiKey(asDb(db), systemId, created.id, auth, noopAudit);

    const result = await validateApiKey(asDb(db), created.token);
    expect(result).toBeNull();
  });

  it("returns null for a non-existent token", async () => {
    const result = await validateApiKey(asDb(db), "ps_nonexistent_token");
    expect(result).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const created = await createApiKey(
      asDb(db),
      systemId,
      makeCreateParams(["read:notes"], { expiresAt: 1 }),
      auth,
      noopAudit,
    );

    const result = await validateApiKey(asDb(db), created.token);
    expect(result).toBeNull();
  });
});
