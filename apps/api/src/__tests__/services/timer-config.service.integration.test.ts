import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgTimerTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { archiveCheckInRecord } from "../../services/check-in-record/archive.js";
import { createCheckInRecord } from "../../services/check-in-record/create.js";
import { deleteCheckInRecord } from "../../services/check-in-record/delete.js";
import { createTimerConfig } from "../../services/timer-config/create.js";
import { deleteTimerConfig } from "../../services/timer-config/delete.js";
import { archiveTimerConfig, restoreTimerConfig } from "../../services/timer-config/lifecycle.js";
import {
  getTimerConfig,
  listTimerConfigs,
  parseTimerConfigQuery,
} from "../../services/timer-config/queries.js";
import { updateTimerConfig } from "../../services/timer-config/update.js";
import {
  assertApiError,
  genTimerId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
  asDb,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type {
  CreateTimerConfigBodySchema,
  UpdateTimerConfigBodySchema,
} from "@pluralscape/validation";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { z } from "zod/v4";

const { timerConfigs, checkInRecords } = schema;

describe("timer-config.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgTimerTables(client);
    const accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
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
    overrides: Partial<z.infer<typeof CreateTimerConfigBodySchema>> = {},
  ): z.infer<typeof CreateTimerConfigBodySchema> {
    return { encryptedData: testEncryptedDataBase64(), ...overrides };
  }

  function updateParams(
    overrides: Partial<z.infer<typeof UpdateTimerConfigBodySchema>> = {},
  ): z.infer<typeof UpdateTimerConfigBodySchema> {
    return { encryptedData: testEncryptedDataBase64(), version: 1, ...overrides };
  }

  describe("createTimerConfig", () => {
    it("creates with defaults (enabled=true, no waking hours)", async () => {
      const audit = spyAudit();
      const result = await createTimerConfig(asDb(db), systemId, createParams(), auth, audit);
      expect(result.id).toMatch(/^tmr_/);
      expect(result.enabled).toBe(true);
      expect(result.wakingHoursOnly).toBeNull();
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("timer-config.created");
    });

    it("creates with waking hours configuration", async () => {
      const result = await createTimerConfig(
        asDb(db),
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

    it("allows overnight waking hours (start > end crosses midnight)", async () => {
      const result = await createTimerConfig(
        asDb(db),
        systemId,
        createParams({
          wakingHoursOnly: true,
          wakingStart: "22:00",
          wakingEnd: "08:00",
        }),
        auth,
        noopAudit,
      );
      expect(result.wakingHoursOnly).toBe(true);
      expect(result.wakingStart).toBe("22:00");
      expect(result.wakingEnd).toBe("08:00");
    });
  });

  describe("listTimerConfigs", () => {
    it("returns configs with pagination", async () => {
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      const t2 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);

      const result = await listTimerConfigs(asDb(db), systemId, auth);
      expect(result.data.length).toBe(2);
      const ids = result.data.map((i) => i.id);
      expect(ids).toContain(t1.id);
      expect(ids).toContain(t2.id);
    });

    it("excludes archived by default", async () => {
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await archiveTimerConfig(asDb(db), systemId, t1.id, auth, noopAudit);
      await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);

      const result = await listTimerConfigs(asDb(db), systemId, auth);
      expect(result.data.length).toBe(1);
    });
  });

  describe("getTimerConfig", () => {
    it("returns the config by ID", async () => {
      const created = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      const fetched = await getTimerConfig(asDb(db), systemId, created.id, auth);
      expect(fetched.id).toBe(created.id);
    });

    it("throws NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        getTimerConfig(asDb(db), systemId, genTimerId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("updateTimerConfig", () => {
    it("updates on correct version", async () => {
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);

      const result = await updateTimerConfig(
        asDb(db),
        systemId,
        t1.id,
        updateParams({ version: 1, enabled: false }),
        auth,
        noopAudit,
      );
      expect(result.version).toBe(2);
      expect(result.enabled).toBe(false);
    });

    it("throws CONFLICT on stale version", async () => {
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await updateTimerConfig(
        asDb(db),
        systemId,
        t1.id,
        updateParams({ version: 1 }),
        auth,
        noopAudit,
      );
      await assertApiError(
        updateTimerConfig(asDb(db), systemId, t1.id, updateParams({ version: 1 }), auth, noopAudit),
        "CONFLICT",
        409,
      );
    });
  });

  describe("deleteTimerConfig", () => {
    it("deletes with no check-in records", async () => {
      const audit = spyAudit();
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await deleteTimerConfig(asDb(db), systemId, t1.id, auth, audit);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("timer-config.deleted");
      await assertApiError(getTimerConfig(asDb(db), systemId, t1.id, auth), "NOT_FOUND", 404);
    });

    it("throws HAS_DEPENDENTS with non-archived check-in records", async () => {
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: t1.id, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      await assertApiError(
        deleteTimerConfig(asDb(db), systemId, t1.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );

      // Clean up: delete the record so afterEach can clean timerConfigs
      await deleteCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);
    });

    it("succeeds after archiving and hard-deleting all check-in records", async () => {
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);

      // Create a check-in record via service
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: t1.id, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      // Archive and then delete the record
      await archiveCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);
      await deleteCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);

      // Now the timer config can be deleted
      await deleteTimerConfig(asDb(db), systemId, t1.id, auth, noopAudit);
    });
  });

  describe("archiveTimerConfig / restoreTimerConfig", () => {
    it("archives and restores with version increments", async () => {
      const t1 = await createTimerConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await archiveTimerConfig(asDb(db), systemId, t1.id, auth, noopAudit);

      await assertApiError(getTimerConfig(asDb(db), systemId, t1.id, auth), "NOT_FOUND", 404);

      const restored = await restoreTimerConfig(asDb(db), systemId, t1.id, auth, noopAudit);
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
