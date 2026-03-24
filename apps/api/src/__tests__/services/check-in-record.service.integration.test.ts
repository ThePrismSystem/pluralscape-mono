import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgTimerTables,
  pgInsertAccount,
  pgInsertMember,
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
  parseCheckInRecordQuery,
  respondCheckInRecord,
} from "../../services/check-in-record.service.js";
import { createTimerConfig } from "../../services/timer-config.service.js";
import {
  assertApiError,
  genCheckInRecordId,
  genMemberId,
  genTimerId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
  asDb,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, MemberId, SystemId, TimerId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { checkInRecords } = schema;

describe("check-in-record.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let memberId: MemberId;
  let timerId: TimerId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgTimerTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    memberId = (await pgInsertMember(db, systemId, genMemberId())) as MemberId;

    auth = makeAuth(accountId, systemId);

    const t = await createTimerConfig(
      asDb(db),
      systemId,
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
      const audit = spyAudit();
      const result = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        audit,
      );
      expect(result.id).toMatch(/^cir_/);
      expect(result.timerConfigId).toBe(timerId);
      expect(result.status).toBe("pending");
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("check-in-record.created");
      expect(audit.calls[0]?.actor).toEqual({ kind: "account", id: auth.accountId });
    });

    it("rejects unknown timer config", async () => {
      await assertApiError(
        createCheckInRecord(
          asDb(db),
          systemId,
          { timerConfigId: genTimerId(), scheduledAt: Date.now() },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("getCheckInRecord", () => {
    it("returns the record by ID", async () => {
      const created = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      const fetched = await getCheckInRecord(asDb(db), systemId, created.id, auth);
      expect(fetched.id).toBe(created.id);
      expect(fetched.timerConfigId).toBe(timerId);
    });

    it("throws NOT_FOUND for nonexistent ID", async () => {
      await assertApiError(
        getCheckInRecord(asDb(db), systemId, genCheckInRecordId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("respondCheckInRecord", () => {
    it("sets respondedByMemberId and respondedAt", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      const result = await respondCheckInRecord(
        asDb(db),
        systemId,
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
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await respondCheckInRecord(
        asDb(db),
        systemId,
        record.id,
        { respondedByMemberId: memberId },
        auth,
        noopAudit,
      );

      await assertApiError(
        respondCheckInRecord(
          asDb(db),
          systemId,
          record.id,
          { respondedByMemberId: memberId },
          auth,
          noopAudit,
        ),
        "ALREADY_RESPONDED",
        409,
      );
    });

    it("throws ALREADY_DISMISSED", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await dismissCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);

      await assertApiError(
        respondCheckInRecord(
          asDb(db),
          systemId,
          record.id,
          { respondedByMemberId: memberId },
          auth,
          noopAudit,
        ),
        "ALREADY_DISMISSED",
        409,
      );
    });

    it("validates member exists in system", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await assertApiError(
        respondCheckInRecord(
          asDb(db),
          systemId,
          record.id,
          { respondedByMemberId: genMemberId() },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("dismissCheckInRecord", () => {
    it("sets dismissed=true", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      const result = await dismissCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);
      expect(result.status).toBe("dismissed");
      expect(result.dismissed).toBe(true);
    });

    it("throws ALREADY_RESPONDED", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await respondCheckInRecord(
        asDb(db),
        systemId,
        record.id,
        { respondedByMemberId: memberId },
        auth,
        noopAudit,
      );

      await assertApiError(
        dismissCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit),
        "ALREADY_RESPONDED",
        409,
      );
    });

    it("throws ALREADY_DISMISSED", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await dismissCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);

      await assertApiError(
        dismissCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit),
        "ALREADY_DISMISSED",
        409,
      );
    });
  });

  describe("listCheckInRecords", () => {
    it("filters by timerConfigId", async () => {
      const created = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );

      const result = await listCheckInRecords(asDb(db), systemId, auth, {
        timerConfigId: timerId,
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.id).toBe(created.id);
    });

    it("filters pending records", async () => {
      const r1 = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      const r2 = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await respondCheckInRecord(
        asDb(db),
        systemId,
        r1.id,
        { respondedByMemberId: memberId },
        auth,
        noopAudit,
      );

      const result = await listCheckInRecords(asDb(db), systemId, auth, {
        pending: true,
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.id).toBe(r2.id);
    });
  });

  describe("deleteCheckInRecord", () => {
    it("always succeeds", async () => {
      const audit = spyAudit();
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await deleteCheckInRecord(asDb(db), systemId, record.id, auth, audit);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("check-in-record.deleted");

      await assertApiError(getCheckInRecord(asDb(db), systemId, record.id, auth), "NOT_FOUND", 404);
    });

    it("throws NOT_FOUND for nonexistent record", async () => {
      await assertApiError(
        deleteCheckInRecord(asDb(db), systemId, genCheckInRecordId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("archiveCheckInRecord", () => {
    it("archives a pending record", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await archiveCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);

      await assertApiError(getCheckInRecord(asDb(db), systemId, record.id, auth), "NOT_FOUND", 404);
    });

    it("throws ALREADY_ARCHIVED", async () => {
      const record = await createCheckInRecord(
        asDb(db),
        systemId,
        { timerConfigId: timerId, scheduledAt: Date.now() },
        auth,
        noopAudit,
      );
      await archiveCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit);
      await assertApiError(
        archiveCheckInRecord(asDb(db), systemId, record.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });
  });

  describe("parseCheckInRecordQuery", () => {
    it("returns defaults for empty query", () => {
      const result = parseCheckInRecordQuery({});
      expect(result).toEqual({ pending: false, includeArchived: false });
    });

    it("parses timerConfigId filter", () => {
      const id = genTimerId();
      const result = parseCheckInRecordQuery({ timerConfigId: id });
      expect(result.timerConfigId).toBe(id);
    });

    it("parses pending boolean", () => {
      const result = parseCheckInRecordQuery({ pending: "true" });
      expect(result.pending).toBe(true);
    });
  });
});
