import { PGlite } from "@electric-sql/pglite";
import { accounts, apiKeys, systems, webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createWebhookConfig } from "../../services/webhook-config.service.js";
import { dispatchWebhookEvent } from "../../services/webhook-dispatcher.js";
import { makeAuth, noopAudit } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, WebhookEventType } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("webhook-dispatcher (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(webhookDeliveries);
    await db.delete(webhookConfigs);
  });

  it("matches enabled non-archived configs by event type", async () => {
    await createWebhookConfig(
      db as never,
      systemId as SystemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"] },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(
      db as never,
      systemId as SystemId,
      "fronting.started" as WebhookEventType,
      { test: true },
    );
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
      db as never,
      systemId as SystemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"] },
      auth,
      noopAudit,
    );
    await createWebhookConfig(
      db as never,
      systemId as SystemId,
      { url: "https://example.com/b", eventTypes: ["fronting.started", "fronting.ended"] },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(
      db as never,
      systemId as SystemId,
      "fronting.started" as WebhookEventType,
      { test: true },
    );
    expect(ids.length).toBe(2);
  });

  it("skips disabled configs", async () => {
    await createWebhookConfig(
      db as never,
      systemId as SystemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"], enabled: false },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(
      db as never,
      systemId as SystemId,
      "fronting.started" as WebhookEventType,
      { test: true },
    );
    expect(ids.length).toBe(0);
  });

  it("skips archived configs", async () => {
    const wh = await createWebhookConfig(
      db as never,
      systemId as SystemId,
      { url: "https://example.com/a", eventTypes: ["fronting.started"] },
      auth,
      noopAudit,
    );
    // Archive directly
    await db
      .update(webhookConfigs)
      .set({ archived: true, archivedAt: Date.now() })
      .where(eq(webhookConfigs.id, wh.id));

    const ids = await dispatchWebhookEvent(
      db as never,
      systemId as SystemId,
      "fronting.started" as WebhookEventType,
      { test: true },
    );
    expect(ids.length).toBe(0);
  });

  it("skips non-matching event types", async () => {
    await createWebhookConfig(
      db as never,
      systemId as SystemId,
      { url: "https://example.com/a", eventTypes: ["fronting.ended"] },
      auth,
      noopAudit,
    );

    const ids = await dispatchWebhookEvent(
      db as never,
      systemId as SystemId,
      "fronting.started" as WebhookEventType,
      { test: true },
    );
    expect(ids.length).toBe(0);
  });
});
