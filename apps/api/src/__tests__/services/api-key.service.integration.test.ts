import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgApiKeysTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { ALL_API_KEY_SCOPES } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiKey, getApiKey, listApiKeys } from "../../services/api-key.service.js";
import {
  asDb,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, ApiKeyScope, SystemId } from "@pluralscape/types";

function makeCreateParams(scopes: readonly ApiKeyScope[], overrides: Record<string, unknown> = {}) {
  return {
    keyType: "metadata" as const,
    scopes: [...scopes],
    encryptedData: testEncryptedDataBase64(),
    ...overrides,
  };
}

describe("api-key.service scope validation (PGlite integration)", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgApiKeysTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
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

  // ── All 71 scopes at once ─────────────────────────────────────

  it("creates key with all 71 scopes", async () => {
    const allScopes = [...ALL_API_KEY_SCOPES] as ApiKeyScope[];
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
    expect(match).toBeDefined();
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
    const params = { keyType: "metadata", encryptedData: testEncryptedDataBase64() };
    await expect(createApiKey(asDb(db), systemId, params, auth, noopAudit)).rejects.toThrow(
      "Invalid payload",
    );
  });
});
