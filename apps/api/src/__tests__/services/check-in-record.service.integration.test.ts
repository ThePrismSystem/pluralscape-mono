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
  dismissCheckInRecord,
  getCheckInRecord,
  listCheckInRecords,
  respondCheckInRecord,
} from "../../services/check-in-record.service.js";
import { createTimerConfig } from "../../services/timer-config.service.js";
import {
  genMemberId,
  genTimerId,
  makeAuth,
  noopAudit,
  testBlob,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { CheckInRecordId, SystemId, TimerId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, timerConfigs, checkInRecords };

describe("check-in-record.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;
  let memberId: string;
  let timerId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgTimerTables(client);

    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);

    memberId = genMemberId();
    const now = Date.now();
    await db.insert(members).values({
      id: memberId,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    auth = makeAuth(accountId, systemId);

    const t = await createTimerConfig(
      db as never,
      systemId as SystemId,
      { encryptedData: testEncryptedDataBase64() },
      auth,
      noopAudit,
    );
    timerId = t.id;
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(checkInRecords);
  });

  describe("createCheckInRecord", () => {
    it("creates linked to timer config", async () => {
      const result = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      expect(result.id).toMatch(/^cir_/);
      expect(result.timerConfigId).toBe(timerId);
      expect(result.status).toBe("pending");
    });

    it("rejects unknown timer config", async () => {
      await expect(
        createCheckInRecord(
          db as never,
          systemId as SystemId,
          { timerConfigId: genTimerId(), scheduledAt: Date.now() },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Timer config not found");
    });
  });

  describe("respondCheckInRecord", () => {
    it("sets respondedByMemberId and respondedAt", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      const result = await respondCheckInRecord(
        db as never,
        systemId as SystemId,
        record.id,
        { respondedByMemberId: memberId },
        auth,
        noopAudit,
      );
      expect(result.status).toBe("responded");
      expect(result.respondedByMemberId).toBe(memberId);
      expect(result.respondedAt).toEqual(expect.any(Number));
    });

    it("throws ALREADY_RESPONDED", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await respondCheckInRecord(
        db as never,
        systemId as SystemId,
        record.id,
        { respondedByMemberId: memberId },
        auth,
        noopAudit,
      );

      await expect(
        respondCheckInRecord(
          db as never,
          systemId as SystemId,
          record.id,
          { respondedByMemberId: memberId },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("already responded");
    });

    it("throws ALREADY_DISMISSED", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await dismissCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit);

      await expect(
        respondCheckInRecord(
          db as never,
          systemId as SystemId,
          record.id,
          { respondedByMemberId: memberId },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("already dismissed");
    });

    it("validates member exists in system", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await expect(
        respondCheckInRecord(
          db as never,
          systemId as SystemId,
          record.id,
          { respondedByMemberId: genMemberId() },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Member not found");
    });
  });

  describe("dismissCheckInRecord", () => {
    it("sets dismissed=true", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      const result = await dismissCheckInRecord(
        db as never,
        systemId as SystemId,
        record.id,
        auth,
        noopAudit,
      );
      expect(result.status).toBe("dismissed");
      expect(result.dismissed).toBe(true);
    });

    it("throws ALREADY_RESPONDED", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await respondCheckInRecord(
        db as never,
        systemId as SystemId,
        record.id,
        { respondedByMemberId: memberId },
        auth,
        noopAudit,
      );

      await expect(
        dismissCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit),
      ).rejects.toThrow("already responded");
    });

    it("throws ALREADY_DISMISSED", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await dismissCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit);

      await expect(
        dismissCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit),
      ).rejects.toThrow("already dismissed");
    });
  });

  describe("listCheckInRecords", () => {
    it("filters by timerConfigId", async () => {
      await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      const result = await listCheckInRecords(db as never, systemId as SystemId, auth, {
        timerConfigId: timerId as TimerId,
      });
      expect(result.items.length).toBe(1);
    });

    it("filters pending records", async () => {
      const r1 = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await respondCheckInRecord(
        db as never,
        systemId as SystemId,
        r1.id,
        { respondedByMemberId: memberId },
        auth,
        noopAudit,
      );

      const result = await listCheckInRecords(db as never, systemId as SystemId, auth, {
        pending: true,
      });
      expect(result.items.length).toBe(1);
    });
  });

  describe("deleteCheckInRecord", () => {
    it("always succeeds", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await deleteCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit);
      await expect(
        getCheckInRecord(db as never, systemId as SystemId, record.id, auth),
      ).rejects.toThrow("not found");
    });

    it("throws NOT_FOUND for nonexistent record", async () => {
      await expect(
        deleteCheckInRecord(
          db as never,
          systemId as SystemId,
          `cir_${crypto.randomUUID()}` as CheckInRecordId,
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found");
    });
  });

  describe("archiveCheckInRecord", () => {
    it("archives a pending record", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await archiveCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit);

      await expect(
        getCheckInRecord(db as never, systemId as SystemId, record.id, auth),
      ).rejects.toThrow("not found");
    });

    it("throws ALREADY_ARCHIVED", async () => {
      const record = await createCheckInRecord(
        db as never,
        systemId as SystemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await archiveCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit);
      await expect(
        archiveCheckInRecord(db as never, systemId as SystemId, record.id, auth, noopAudit),
      ).rejects.toThrow("already archived");
    });
  });
});
