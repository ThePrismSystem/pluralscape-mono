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
  archiveCheckInRecord,
  createCheckInRecord,
  deleteCheckInRecord,
} from "../../services/check-in-record.service.js";
import {
  archiveTimerConfig,
  createTimerConfig,
  deleteTimerConfig,
  getTimerConfig,
  listTimerConfigs,
  parseTimerConfigQuery,
  restoreTimerConfig,
  updateTimerConfig,
} from "../../services/timer-config.service.js";
import {
  assertApiError,
  genTimerId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, timerConfigs, checkInRecords };

describe("timer-config.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgTimerTables(client);
    const accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(checkInRecords);
    await db.delete(timerConfigs);
  });

  function createParams(
    overrides: Partial<{
      encryptedData: string;
      version: number;
      enabled: boolean;
      intervalMinutes: number;
      wakingHoursOnly: boolean;
      wakingStart: string;
      wakingEnd: string;
    }> = {},
  ) {
    return { encryptedData: testEncryptedDataBase64(), ...overrides };
  }

  describe("createTimerConfig", () => {
    it("creates with defaults (enabled=true, no waking hours)", async () => {
      const audit = spyAudit();
      const result = await createTimerConfig(db as never, systemId, createParams(), auth, audit);
      expect(result.id).toMatch(/^tmr_/);
      expect(result.enabled).toBe(true);
      expect(result.wakingHoursOnly).toBeNull();
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("timer-config.created");
    });

    it("creates with waking hours configuration", async () => {
      const result = await createTimerConfig(
        db as never,
        systemId,
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
      await assertApiError(
        createTimerConfig(
          db as never,
          systemId,
          createParams({ wakingHoursOnly: true }),
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });

    it("rejects wakingStart >= wakingEnd", async () => {
      await assertApiError(
        createTimerConfig(
          db as never,
          systemId,
          createParams({
            wakingHoursOnly: true,
            wakingStart: "22:00",
            wakingEnd: "08:00",
          }),
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("listTimerConfigs", () => {
    it("returns configs with pagination", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);
      const t2 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);

      const result = await listTimerConfigs(db as never, systemId, auth);
      expect(result.items.length).toBe(2);
      const ids = result.items.map((i) => i.id);
      expect(ids).toContain(t1.id);
      expect(ids).toContain(t2.id);
    });

    it("excludes archived by default", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);
      await archiveTimerConfig(db as never, systemId, t1.id, auth, noopAudit);
      await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);

      const result = await listTimerConfigs(db as never, systemId, auth);
      expect(result.items.length).toBe(1);
    });
  });

  describe("getTimerConfig", () => {
    it("returns the config by ID", async () => {
      const created = await createTimerConfig(
        db as never,
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      const fetched = await getTimerConfig(db as never, systemId, created.id, auth);
      expect(fetched.id).toBe(created.id);
    });

    it("throws NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        getTimerConfig(db as never, systemId, genTimerId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("updateTimerConfig", () => {
    it("updates on correct version", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);

      const result = await updateTimerConfig(
        db as never,
        systemId,
        t1.id,
        createParams({ version: 1, enabled: false }),
        auth,
        noopAudit,
      );
      expect(result.version).toBe(2);
      expect(result.enabled).toBe(false);
    });

    it("throws CONFLICT on stale version", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);
      await updateTimerConfig(
        db as never,
        systemId,
        t1.id,
        createParams({ version: 1 }),
        auth,
        noopAudit,
      );
      await assertApiError(
        updateTimerConfig(
          db as never,
          systemId,
          t1.id,
          createParams({ version: 1 }),
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("re-validates waking hours on update", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);
      await assertApiError(
        updateTimerConfig(
          db as never,
          systemId,
          t1.id,
          createParams({ version: 1, wakingHoursOnly: true }),
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("deleteTimerConfig", () => {
    it("deletes with no check-in records", async () => {
      const audit = spyAudit();
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);
      await deleteTimerConfig(db as never, systemId, t1.id, auth, audit);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("timer-config.deleted");
      await assertApiError(getTimerConfig(db as never, systemId, t1.id, auth), "NOT_FOUND", 404);
    });

    it("throws HAS_DEPENDENTS with non-archived check-in records", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);
      const record = await createCheckInRecord(
        db as never,
        systemId,
        { timerConfigId: t1.id, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      await assertApiError(
        deleteTimerConfig(db as never, systemId, t1.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );

      // Clean up: delete the record so afterEach can clean timerConfigs
      await deleteCheckInRecord(db as never, systemId, record.id, auth, noopAudit);
    });

    it("succeeds after archiving and hard-deleting all check-in records", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);

      // Create a check-in record via service
      const record = await createCheckInRecord(
        db as never,
        systemId,
        { timerConfigId: t1.id, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      // Archive and then delete the record
      await archiveCheckInRecord(db as never, systemId, record.id, auth, noopAudit);
      await deleteCheckInRecord(db as never, systemId, record.id, auth, noopAudit);

      // Now the timer config can be deleted
      await deleteTimerConfig(db as never, systemId, t1.id, auth, noopAudit);
    });
  });

  describe("archiveTimerConfig / restoreTimerConfig", () => {
    it("archives and restores with version increments", async () => {
      const t1 = await createTimerConfig(db as never, systemId, createParams(), auth, noopAudit);
      await archiveTimerConfig(db as never, systemId, t1.id, auth, noopAudit);

      await assertApiError(getTimerConfig(db as never, systemId, t1.id, auth), "NOT_FOUND", 404);

      const restored = await restoreTimerConfig(db as never, systemId, t1.id, auth, noopAudit);
      expect(restored.archived).toBe(false);
      expect(restored.version).toBe(3);
    });
  });

  describe("parseTimerConfigQuery", () => {
    it("returns defaults for empty query", () => {
      const result = parseTimerConfigQuery({});
      expect(result).toEqual({ includeArchived: false });
    });

    it("parses includeArchived boolean", () => {
      const result = parseTimerConfigQuery({ includeArchived: "true" });
      expect(result.includeArchived).toBe(true);
    });
  });
});
