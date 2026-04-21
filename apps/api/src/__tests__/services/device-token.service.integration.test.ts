import { PGlite } from "@electric-sql/pglite";
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import * as schema from "@pluralscape/db/pg";
import {
  createPgNotificationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { hashDeviceToken } from "../../services/device-token/internal.js";
import { listDeviceTokens } from "../../services/device-token/queries.js";
import { registerDeviceToken } from "../../services/device-token/register.js";
import { revokeDeviceToken } from "../../services/device-token/revoke.js";
import {
  assertApiError,
  asDb,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, DeviceTokenId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { deviceTokens } = schema;

describe("device-token.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    configureSodium(new WasmSodiumAdapter());
    await initSodium();

    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgNotificationTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(deviceTokens);
  });

  // ── registerDeviceToken ──────────────────────────────────────────────

  it("registers a new device token with dt_ prefix", async () => {
    const result = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "apns-token-abc" },
      auth,
      noopAudit,
    );

    expect(result.id).toMatch(/^dt_/);
    expect(result.systemId).toBe(systemId);
    expect(result.platform).toBe("ios");
    expect(result.tokenHash).toBe(hashDeviceToken("apns-token-abc"));
    expect(result.createdAt).toBeTypeOf("number");
  });

  it("stores token as hash, not plaintext", async () => {
    const plaintext = "plaintext-token-for-hash-test";
    await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: plaintext },
      auth,
      noopAudit,
    );

    const [row] = await db
      .select({ tokenHash: deviceTokens.tokenHash })
      .from(deviceTokens)
      .where(eq(deviceTokens.tokenHash, hashDeviceToken(plaintext)));
    expect(row?.tokenHash).toBe(hashDeviceToken(plaintext));
    expect(row?.tokenHash).not.toBe(plaintext);
  });

  it("upserts on same token+platform (updates lastActiveAt)", async () => {
    const first = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "android", token: "fcm-token-xyz" },
      auth,
      noopAudit,
    );

    const second = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "android", token: "fcm-token-xyz" },
      auth,
      noopAudit,
    );

    // Should return same record (upsert, not duplicate)
    expect(second.id).toBe(first.id);
    expect(second.tokenHash).toBe(hashDeviceToken("fcm-token-xyz"));
  });

  it("creates separate record for same token on different platform", async () => {
    const ios = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "shared-token" },
      auth,
      noopAudit,
    );

    const web = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "web", token: "shared-token" },
      auth,
      noopAudit,
    );

    expect(ios.id).not.toBe(web.id);
    expect(ios.platform).toBe("ios");
    expect(web.platform).toBe("web");
  });

  it("writes audit event on register", async () => {
    const audit = spyAudit();
    await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "audit-test-token" },
      auth,
      audit,
    );

    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.eventType).toBe("device-token.registered");
  });

  // ── revokeDeviceToken ────────────────────────────────────────────────

  it("revokes a token (excluded from list)", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "revoke-me" },
      auth,
      noopAudit,
    );

    await revokeDeviceToken(asDb(db), systemId, registered.id, auth, noopAudit);

    const { data: tokens } = await listDeviceTokens(asDb(db), systemId, auth);
    expect(tokens.map((t) => t.id)).not.toContain(registered.id);
  });

  it("writes audit event on revoke", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "revoke-audit-test" },
      auth,
      noopAudit,
    );

    const audit = spyAudit();
    await revokeDeviceToken(asDb(db), systemId, registered.id, auth, audit);

    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.eventType).toBe("device-token.revoked");
  });

  it("returns 404 when revoking non-existent token", async () => {
    await assertApiError(
      revokeDeviceToken(
        asDb(db),
        systemId,
        brandId<DeviceTokenId>("dt_nonexistent"),
        auth,
        noopAudit,
      ),
      "NOT_FOUND",
      404,
    );
  });

  it("returns 404 when revoking already-revoked token", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "double-revoke" },
      auth,
      noopAudit,
    );

    await revokeDeviceToken(asDb(db), systemId, registered.id, auth, noopAudit);

    await assertApiError(
      revokeDeviceToken(asDb(db), systemId, registered.id, auth, noopAudit),
      "NOT_FOUND",
      404,
    );
  });

  // ── listDeviceTokens ────────────────────────────────────────────────

  it("lists only non-revoked tokens ordered by createdAt desc", async () => {
    const t1 = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "list-token-1" },
      auth,
      noopAudit,
    );
    const t2 = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "android", token: "list-token-2" },
      auth,
      noopAudit,
    );
    const t3 = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "web", token: "list-token-3" },
      auth,
      noopAudit,
    );

    // Revoke the second one
    await revokeDeviceToken(asDb(db), systemId, t2.id, auth, noopAudit);

    const { data: tokens } = await listDeviceTokens(asDb(db), systemId, auth);
    const ids = tokens.map((t) => t.id);

    expect(ids).toContain(t1.id);
    expect(ids).not.toContain(t2.id);
    expect(ids).toContain(t3.id);
    expect(ids).toHaveLength(2);

    // Newest first
    expect(ids[0]).toBe(t3.id);
    expect(ids[1]).toBe(t1.id);
  });

  // ── upsert ownership protection ─────────────────────────────────────

  it("does not reassign token ownership when different account registers same token", async () => {
    // Account A registers a token
    const original = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "reassign-test-token" },
      auth,
      noopAudit,
    );

    // Account B tries to register the same token+platform
    const otherAccountId = brandId<AccountId>(await pgInsertAccount(db));
    const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, otherAccountId));
    const otherAuth = makeAuth(otherAccountId, otherSystemId);

    const audit = spyAudit();
    const result = await registerDeviceToken(
      asDb(db),
      otherSystemId,
      { platform: "ios", token: "reassign-test-token" },
      otherAuth,
      audit,
    );

    // Should return a result (no error) but not modify the DB row
    expect(result.systemId).toBe(otherSystemId);
    expect(result.tokenHash).toBe(hashDeviceToken("reassign-test-token"));

    // No audit event should be written for the no-op
    expect(audit.calls).toHaveLength(0);

    // Verify in DB that accountId was NOT reassigned — still belongs to account A
    const [row] = await db
      .select({ accountId: deviceTokens.accountId, systemId: deviceTokens.systemId })
      .from(deviceTokens)
      .where(eq(deviceTokens.tokenHash, hashDeviceToken("reassign-test-token")));
    expect(row?.accountId).toBe(accountId);
    expect(row?.systemId).toBe(systemId);

    // Original account can still see the token in their list
    const { data: listResult } = await listDeviceTokens(asDb(db), systemId, auth);
    expect(listResult.some((t) => t.id === original.id)).toBe(true);
  });

  it("clears revokedAt on re-registration of revoked token", async () => {
    const registered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "revoke-reregister" },
      auth,
      noopAudit,
    );

    await revokeDeviceToken(asDb(db), systemId, registered.id, auth, noopAudit);

    // Re-register same token
    const reregistered = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "revoke-reregister" },
      auth,
      noopAudit,
    );

    // Should appear in list (revokedAt cleared)
    const { data: reregTokens } = await listDeviceTokens(asDb(db), systemId, auth);
    expect(reregTokens.map((t) => t.id)).toContain(reregistered.id);
  });

  // ── token hashing ──────────────────────────────────────────────────

  it("returns hashed token in registration response", async () => {
    const result = await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "a-very-long-registration-token" },
      auth,
      noopAudit,
    );

    expect(result.tokenHash).toBe(hashDeviceToken("a-very-long-registration-token"));
    expect(result.tokenHash).not.toContain("a-very-long");
  });

  // ── list returns hashes ───────────────────────────────────────────

  it("returns hashed token values in list response", async () => {
    await registerDeviceToken(
      asDb(db),
      systemId,
      { platform: "ios", token: "a-very-long-token-string-for-testing" },
      auth,
      noopAudit,
    );

    const { data: tokens } = await listDeviceTokens(asDb(db), systemId, auth);
    expect(tokens[0]?.tokenHash).toBe(hashDeviceToken("a-very-long-token-string-for-testing"));
    expect(tokens[0]?.tokenHash).not.toBe("a-very-long-token-string-for-testing");
  });

  // ── Authorization ────────────────────────────────────────────────────

  it("returns 404 when system not owned by auth context", async () => {
    const otherAccountId = brandId<AccountId>(await pgInsertAccount(db));
    const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, otherAccountId));
    const otherAuth = makeAuth(otherAccountId, otherSystemId);

    await assertApiError(
      registerDeviceToken(
        asDb(db),
        systemId,
        { platform: "ios", token: "unauthorized-token" },
        otherAuth,
        noopAudit,
      ),
      "NOT_FOUND",
      404,
    );
  });
});
