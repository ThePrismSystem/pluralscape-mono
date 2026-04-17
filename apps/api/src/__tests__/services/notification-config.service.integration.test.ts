import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgNotificationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getOrCreateNotificationConfig,
  listNotificationConfigs,
  updateNotificationConfig,
} from "../../services/notification-config.service.js";
import {
  assertApiError,
  asDb,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { notificationConfigs } = schema;

describe("notification-config.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
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
    await db.delete(notificationConfigs);
  });

  // ── getOrCreateNotificationConfig ────────────────────────────────────

  it("creates config with defaults on first access", async () => {
    const result = await getOrCreateNotificationConfig(
      asDb(db),
      systemId,
      "friend-switch-alert",
      auth,
    );

    expect(result.id).toMatch(/^nc_/);
    expect(result.systemId).toBe(systemId);
    expect(result.eventType).toBe("friend-switch-alert");
    expect(result.enabled).toBe(true);
    expect(result.pushEnabled).toBe(true);
    expect(result.createdAt).toBeTypeOf("number");
    expect(result.updatedAt).toBeTypeOf("number");
  });

  it("returns same record on subsequent calls (idempotent)", async () => {
    const first = await getOrCreateNotificationConfig(asDb(db), systemId, "switch-reminder", auth);
    const second = await getOrCreateNotificationConfig(asDb(db), systemId, "switch-reminder", auth);

    expect(second.id).toBe(first.id);
    expect(second.enabled).toBe(first.enabled);
  });

  // ── updateNotificationConfig ─────────────────────────────────────────

  it("updates enabled flag", async () => {
    await getOrCreateNotificationConfig(asDb(db), systemId, "friend-switch-alert", auth);

    const updated = await updateNotificationConfig(
      asDb(db),
      systemId,
      "friend-switch-alert",
      { enabled: false },
      auth,
      noopAudit,
    );

    expect(updated.enabled).toBe(false);
    expect(updated.pushEnabled).toBe(true);
  });

  it("updates pushEnabled flag", async () => {
    await getOrCreateNotificationConfig(asDb(db), systemId, "check-in-due", auth);

    const updated = await updateNotificationConfig(
      asDb(db),
      systemId,
      "check-in-due",
      { pushEnabled: false },
      auth,
      noopAudit,
    );

    expect(updated.pushEnabled).toBe(false);
    expect(updated.enabled).toBe(true);
  });

  it("writes audit event on update", async () => {
    await getOrCreateNotificationConfig(asDb(db), systemId, "sync-conflict", auth);

    const audit = spyAudit();
    await updateNotificationConfig(
      asDb(db),
      systemId,
      "sync-conflict",
      { enabled: false },
      auth,
      audit,
    );

    expect(audit.calls).toHaveLength(1);
    expect(audit.calls[0]?.eventType).toBe("notification-config.updated");
  });

  it("auto-creates config when updating non-existent event type", async () => {
    const result = await updateNotificationConfig(
      asDb(db),
      systemId,
      "message-received",
      { enabled: false },
      auth,
      noopAudit,
    );

    expect(result.id).toMatch(/^nc_/);
    expect(result.eventType).toBe("message-received");
    expect(result.enabled).toBe(false);
    expect(result.pushEnabled).toBe(true);
  });

  it("updates both enabled and pushEnabled simultaneously", async () => {
    await getOrCreateNotificationConfig(asDb(db), systemId, "friend-switch-alert", auth);

    const updated = await updateNotificationConfig(
      asDb(db),
      systemId,
      "friend-switch-alert",
      { enabled: false, pushEnabled: false },
      auth,
      noopAudit,
    );

    expect(updated.enabled).toBe(false);
    expect(updated.pushEnabled).toBe(false);
  });

  // ── listNotificationConfigs ──────────────────────────────────────────

  it("lists all non-archived configs for system", async () => {
    await getOrCreateNotificationConfig(asDb(db), systemId, "friend-switch-alert", auth);
    await getOrCreateNotificationConfig(asDb(db), systemId, "switch-reminder", auth);
    await getOrCreateNotificationConfig(asDb(db), systemId, "check-in-due", auth);

    const configs = await listNotificationConfigs(asDb(db), systemId, auth);
    const eventTypes = configs.map((c) => c.eventType);

    expect(eventTypes).toContain("friend-switch-alert");
    expect(eventTypes).toContain("switch-reminder");
    expect(eventTypes).toContain("check-in-due");
    expect(configs).toHaveLength(3);
  });

  it("returns empty array when no configs exist", async () => {
    const configs = await listNotificationConfigs(asDb(db), systemId, auth);
    expect(configs).toHaveLength(0);
  });

  // ── Authorization ────────────────────────────────────────────────────

  it("returns 404 when system not owned by auth context", async () => {
    const otherAccountId = brandId<AccountId>(await pgInsertAccount(db));
    const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, otherAccountId));
    const otherAuth = makeAuth(otherAccountId, otherSystemId);

    await assertApiError(
      getOrCreateNotificationConfig(asDb(db), systemId, "friend-switch-alert", otherAuth),
      "NOT_FOUND",
      404,
    );
  });
});
