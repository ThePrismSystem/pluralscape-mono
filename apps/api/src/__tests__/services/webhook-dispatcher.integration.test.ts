import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Set encryption key before module load so env.ts picks it up.
vi.hoisted(() => {
  process.env.WEBHOOK_PAYLOAD_ENCRYPTION_KEY = "ab".repeat(32);
});

import { createWebhookConfig } from "../../services/webhook-config/create.js";
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
    await initSodium();
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
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
      sessionId: brandId<FrontingSessionId>("ses_test"),
    });
    expect(ids.length).toBe(1);
    const [firstId] = ids;
    if (!firstId) throw new Error("expected delivery id");

    const [row] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, firstId));
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
      sessionId: brandId<FrontingSessionId>("ses_test"),
    });
    expect(ids.length).toBe(2);

    // Verify all deliveries exist in the DB
    for (const id of ids) {
      const [row] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
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
      sessionId: brandId<FrontingSessionId>("ses_test"),
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
      sessionId: brandId<FrontingSessionId>("ses_test"),
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
      sessionId: brandId<FrontingSessionId>("ses_test"),
    });
    expect(ids.length).toBe(0);
  });
});
