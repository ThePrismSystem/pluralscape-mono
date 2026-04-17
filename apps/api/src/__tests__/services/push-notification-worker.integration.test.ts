import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgNotificationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  StubPushProvider,
  processPushNotification,
} from "../../services/push-notification-worker.js";
import { asDb } from "../helpers/integration-setup.js";

import type { PushProvider } from "../../services/push-notification-worker.js";
import type { AccountId, DeviceTokenId, SystemId } from "@pluralscape/types";
import type { JobPayloadMap } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { deviceTokens } = schema;

describe("push-notification-worker (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  let accountId: AccountId;
  let systemId: SystemId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgNotificationTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(deviceTokens);
    vi.restoreAllMocks();
  });

  async function insertToken(opts?: {
    revokedAt?: number;
  }): Promise<{ id: DeviceTokenId; tokenHash: string }> {
    const id = brandId<DeviceTokenId>(`dt_${crypto.randomUUID()}`);
    const tokenHash = `hash-${crypto.randomUUID()}`;
    const now = Date.now();
    await db.insert(deviceTokens).values({
      id,
      accountId,
      systemId,
      platform: "ios",
      tokenHash,
      createdAt: now,
      lastActiveAt: null,
      revokedAt: opts?.revokedAt ?? null,
    });
    return { id, tokenHash };
  }

  function makePayload(
    tokenId: DeviceTokenId,
    overrides?: { accountId?: AccountId },
  ): JobPayloadMap["notification-send"] {
    return {
      accountId: overrides?.accountId ?? accountId,
      systemId,
      deviceTokenId: tokenId,
      platform: "ios",
      payload: {
        title: "Switch Alert",
        body: "A friend switched fronters",
        data: null,
      },
    };
  }

  // ── processPushNotification ──────────────────────────────────────────

  it("calls provider.send with device token ID and updates lastActiveAt", async () => {
    const { id: tokenId } = await insertToken();
    const sendSpy = vi.fn().mockResolvedValue(undefined);
    const provider: PushProvider = { send: sendSpy };

    await processPushNotification(asDb(db), makePayload(tokenId), provider);

    expect(sendSpy).toHaveBeenCalledWith(tokenId, "ios", {
      title: "Switch Alert",
      body: "A friend switched fronters",
      data: null,
    });

    // Verify lastActiveAt was updated
    const [row] = await db
      .select({ lastActiveAt: deviceTokens.lastActiveAt })
      .from(deviceTokens)
      .where(eq(deviceTokens.id, tokenId));
    expect(row?.lastActiveAt).not.toBeNull();
  });

  it("returns early without calling send when accountId does not match token owner", async () => {
    const { id: tokenId } = await insertToken();
    const sendSpy = vi.fn();
    const provider: PushProvider = { send: sendSpy };
    const wrongAccountId = brandId<AccountId>(`acct_${crypto.randomUUID()}`);

    await processPushNotification(
      asDb(db),
      makePayload(tokenId, { accountId: wrongAccountId }),
      provider,
    );

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("returns early without calling send when token is revoked", async () => {
    const { id: tokenId } = await insertToken({ revokedAt: Date.now() });
    const sendSpy = vi.fn();
    const provider: PushProvider = { send: sendSpy };

    await processPushNotification(asDb(db), makePayload(tokenId), provider);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("returns early without calling send when token not found", async () => {
    const sendSpy = vi.fn();
    const provider: PushProvider = { send: sendSpy };

    await processPushNotification(
      asDb(db),
      makePayload(brandId<DeviceTokenId>("dt_nonexistent")),
      provider,
    );

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("propagates provider errors (for retry by queue)", async () => {
    const { id: tokenId } = await insertToken();
    const provider: PushProvider = {
      send: vi.fn().mockRejectedValue(new Error("APNs unavailable")),
    };

    await expect(processPushNotification(asDb(db), makePayload(tokenId), provider)).rejects.toThrow(
      "APNs unavailable",
    );
  });

  it("does not update lastActiveAt on provider failure", async () => {
    const { id: tokenId } = await insertToken();
    const provider: PushProvider = {
      send: vi.fn().mockRejectedValue(new Error("failed")),
    };

    try {
      await processPushNotification(asDb(db), makePayload(tokenId), provider);
    } catch {
      // Expected
    }

    const [row] = await db
      .select({ lastActiveAt: deviceTokens.lastActiveAt })
      .from(deviceTokens)
      .where(eq(deviceTokens.id, tokenId));
    expect(row?.lastActiveAt).toBeNull();
  });

  // ── StubPushProvider ─────────────────────────────────────────────────

  it("stub provider does not throw", async () => {
    const stub = new StubPushProvider();
    await expect(
      stub.send(brandId<DeviceTokenId>("dt_test-token-id"), "ios", {
        title: "T",
        body: "B",
        data: null,
      }),
    ).resolves.toBeUndefined();
  });
});
