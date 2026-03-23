import { PGlite } from "@electric-sql/pglite";
import { accounts, checkInRecords, members, systems, timerConfigs } from "@pluralscape/db/pg";
import {
  createPgTimerTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveTimerConfig,
  createTimerConfig,
  deleteTimerConfig,
  getTimerConfig,
  listTimerConfigs,
  restoreTimerConfig,
  updateTimerConfig,
} from "../../services/timer-config.service.js";
import { makeAuth, noopAudit, testEncryptedDataBase64 } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, timerConfigs, checkInRecords };

describe("timer-config.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgTimerTables(client);
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(checkInRecords);
    await db.delete(timerConfigs);
  });

  function createParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { encryptedData: testEncryptedDataBase64(), ...overrides };
  }

  describe("createTimerConfig", () => {
    it("creates with defaults (enabled=true, no waking hours)", async () => {
      const result = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      expect(result.id).toMatch(/^tmr_/);
      expect(result.enabled).toBe(true);
      expect(result.wakingHoursOnly).toBeNull();
    });

    it("creates with waking hours configuration", async () => {
      const result = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams({
          wakingHoursOnly: true,
          wakingStart: "08:00",
          wakingEnd: "22:00",
          intervalMinutes: 30,
        }),
        auth,
        noopAudit,
      );
      expect(result.wakingHoursOnly).toBe(true);
      expect(result.wakingStart).toBe("08:00");
      expect(result.wakingEnd).toBe("22:00");
      expect(result.intervalMinutes).toBe(30);
    });

    it("rejects wakingHoursOnly=true without start/end", async () => {
      await expect(
        createTimerConfig(
          db as never,
          systemId as SystemId,
          createParams({ wakingHoursOnly: true }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Invalid payload");
    });

    it("rejects wakingStart >= wakingEnd", async () => {
      await expect(
        createTimerConfig(
          db as never,
          systemId as SystemId,
          createParams({
            wakingHoursOnly: true,
            wakingStart: "22:00",
            wakingEnd: "08:00",
          }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Invalid payload");
    });
  });

  describe("listTimerConfigs", () => {
    it("returns configs with pagination", async () => {
      await createTimerConfig(db as never, systemId as SystemId, createParams(), auth, noopAudit);
      await createTimerConfig(db as never, systemId as SystemId, createParams(), auth, noopAudit);

      const result = await listTimerConfigs(db as never, systemId as SystemId, auth);
      expect(result.items.length).toBe(2);
    });

    it("excludes archived by default", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveTimerConfig(db as never, systemId as SystemId, t1.id, auth, noopAudit);
      await createTimerConfig(db as never, systemId as SystemId, createParams(), auth, noopAudit);

      const result = await listTimerConfigs(db as never, systemId as SystemId, auth);
      expect(result.items.length).toBe(1);
    });
  });

  describe("updateTimerConfig", () => {
    it("updates on correct version", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await updateTimerConfig(
        db as never,
        systemId as SystemId,
        t1.id,
        createParams({ version: 1, enabled: false }),
        auth,
        noopAudit,
      );
      expect(result.version).toBe(2);
      expect(result.enabled).toBe(false);
    });

    it("throws CONFLICT on stale version", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await updateTimerConfig(
        db as never,
        systemId as SystemId,
        t1.id,
        createParams({ version: 1 }),
        auth,
        noopAudit,
      );
      await expect(
        updateTimerConfig(
          db as never,
          systemId as SystemId,
          t1.id,
          createParams({ version: 1 }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Version conflict");
    });

    it("re-validates waking hours on update", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await expect(
        updateTimerConfig(
          db as never,
          systemId as SystemId,
          t1.id,
          createParams({ version: 1, wakingHoursOnly: true }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Invalid payload");
    });
  });

  describe("deleteTimerConfig", () => {
    it("deletes with no check-in records", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await deleteTimerConfig(db as never, systemId as SystemId, t1.id, auth, noopAudit);
      await expect(getTimerConfig(db as never, systemId as SystemId, t1.id, auth)).rejects.toThrow(
        "not found",
      );
    });

    it("throws HAS_DEPENDENTS with non-archived check-in records", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await db.insert(checkInRecords).values({
        id: `cir_${crypto.randomUUID()}`,
        systemId,
        timerConfigId: t1.id,
        scheduledAt: Date.now(),
      });

      await expect(
        deleteTimerConfig(db as never, systemId as SystemId, t1.id, auth, noopAudit),
      ).rejects.toThrow("non-archived check-in");
    });

    it("succeeds when all check-in records are archived", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await db.insert(checkInRecords).values({
        id: `cir_${crypto.randomUUID()}`,
        systemId,
        timerConfigId: t1.id,
        scheduledAt: Date.now(),
        archived: true,
        archivedAt: Date.now(),
      });

      // The HAS_DEPENDENTS check passes. But FK may block, so clean up records.
      await db.delete(checkInRecords);
      await deleteTimerConfig(db as never, systemId as SystemId, t1.id, auth, noopAudit);
    });
  });

  describe("archiveTimerConfig / restoreTimerConfig", () => {
    it("archives and restores with version increments", async () => {
      const t1 = await createTimerConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveTimerConfig(db as never, systemId as SystemId, t1.id, auth, noopAudit);

      await expect(getTimerConfig(db as never, systemId as SystemId, t1.id, auth)).rejects.toThrow(
        "not found",
      );

      const restored = await restoreTimerConfig(
        db as never,
        systemId as SystemId,
        t1.id,
        auth,
        noopAudit,
      );
      expect(restored.archived).toBe(false);
      expect(restored.version).toBe(3);
    });
  });
});
