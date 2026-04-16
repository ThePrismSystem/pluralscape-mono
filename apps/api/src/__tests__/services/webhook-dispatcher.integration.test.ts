import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock encryption — integration tests focus on dispatch logic, not crypto.
const { fakeKey } = vi.hoisted(() => ({
  fakeKey: new Uint8Array(32).fill(0xab),
}));
vi.mock("../../services/webhook-payload-encryption.js", () => ({
  getWebhookPayloadEncryptionKey: vi.fn().mockReturnValue(fakeKey),
  encryptWebhookPayload: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
}));
vi.mock("@pluralscape/crypto", async () => {
  const actual = await vi.importActual("@pluralscape/crypto");
  return { ...actual, getSodium: vi.fn().mockReturnValue({ memzero: vi.fn() }) };
});

import { createWebhookConfig } from "../../services/webhook-config.service.js";
import {
  clearWebhookConfigCache,
  dispatchWebhookEvent,
} from "../../services/webhook-dispatcher.js";
import { asDb, makeAuth, noopAudit } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, FrontingSessionId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { webhookConfigs, webhookDeliveries } = schema;

describe("webhook-dispatcher (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    clearWebhookConfigCache();
    await db.delete(webhookDeliveries);
    await db.delete(webhookConfigs);
  });

  it("matches enabled non-archived configs by event type", async () => {
    await createWebhookConfig(
      asDb(db),
      systemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"] },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(asDb(db), systemId, "fronting.started", {
      sessionId: "ses_test" as FrontingSessionId,
    });
    expect(ids.length).toBe(1);

    const [row] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, ids[0] as string));
    expect(row?.status).toBe("pending");
    expect(row?.eventType).toBe("fronting.started");
  });

  it("creates pending delivery per matching config", async () => {
    await createWebhookConfig(
      asDb(db),
      systemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"] },
      auth,
      noopAudit,
    );
    await createWebhookConfig(
      asDb(db),
      systemId,
      { url: "https://example.com/b", eventTypes: ["fronting.started", "fronting.ended"] },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(asDb(db), systemId, "fronting.started", {
      sessionId: "ses_test" as FrontingSessionId,
    });
    expect(ids.length).toBe(2);

    // Verify all deliveries exist in the DB
    for (const id of ids) {
      const [row] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
      expect(row).toBeDefined();
      expect(row?.status).toBe("pending");
    }
  });

  it("skips disabled configs", async () => {
    await createWebhookConfig(
      asDb(db),
      systemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"], enabled: false },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(asDb(db), systemId, "fronting.started", {
      sessionId: "ses_test" as FrontingSessionId,
    });
    expect(ids.length).toBe(0);
  });

  it("skips archived configs", async () => {
    const wh = await createWebhookConfig(
      asDb(db),
      systemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"] },
      auth,
      noopAudit,
    );
    // Archive directly
    await db
      .update(webhookConfigs)
      .set({ archived: true, archivedAt: Date.now() })
      .where(eq(webhookConfigs.id, wh.id));

    const ids = await dispatchWebhookEvent(asDb(db), systemId, "fronting.started", {
      sessionId: "ses_test" as FrontingSessionId,
    });
    expect(ids.length).toBe(0);
  });

  it("skips non-matching event types", async () => {
    await createWebhookConfig(
      asDb(db),
      systemId,
      { url: "https://example.com/a", eventTypes: ["fronting.ended"] },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(asDb(db), systemId, "fronting.started", {
      sessionId: "ses_test" as FrontingSessionId,
    });
    expect(ids.length).toBe(0);
  });
});
