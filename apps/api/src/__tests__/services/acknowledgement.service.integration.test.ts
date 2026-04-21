import { PGlite } from "@electric-sql/pglite";
import { serializeEncryptedBlob } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { confirmAcknowledgement } from "../../services/acknowledgement/confirm.js";
import { createAcknowledgement } from "../../services/acknowledgement/create.js";
import {
  archiveAcknowledgement,
  deleteAcknowledgement,
  restoreAcknowledgement,
} from "../../services/acknowledgement/lifecycle.js";
import {
  getAcknowledgement,
  listAcknowledgements,
} from "../../services/acknowledgement/queries.js";
import { expectSingleAuditEvent } from "../helpers/audit-assertions.js";
import {
  assertApiError,
  asDb,
  genAcknowledgementId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { acknowledgements } = schema;

function makeCreateParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    encryptedData: testEncryptedDataBase64(),
    ...overrides,
  };
}

describe("acknowledgement.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let memberId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCommunicationTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    const memId = `mem_${crypto.randomUUID()}`;
    memberId = await pgInsertMember(db, systemId, memId);
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(acknowledgements);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createAcknowledgement", () => {
    it("creates with expected shape (confirmed=false, version=1)", async () => {
      const audit = spyAudit();
      const result = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        audit,
      );

      expect(result.id).toMatch(/^ack_/);
      expect(result.systemId).toBe(systemId);
      expect(result.createdByMemberId).toBeNull();
      expect(result.confirmed).toBe(false);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
      expect(result.encryptedData).toEqual(expect.any(String));
      expect(result.createdAt).toEqual(expect.any(Number));
      expect(result.updatedAt).toEqual(expect.any(Number));
    });

    it("creates with createdByMemberId", async () => {
      const result = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams({ createdByMemberId: memberId }),
        auth,
        noopAudit,
      );

      expect(result.createdByMemberId).toBe(memberId);
    });

    it("writes audit event acknowledgement.created", async () => {
      const audit = spyAudit();
      await createAcknowledgement(asDb(db), systemId, makeCreateParams(), auth, audit);

      expectSingleAuditEvent(audit, "acknowledgement.created");
    });
  });

  // ── CONFIRM ─────────────────────────────────────────────────────

  describe("confirmAcknowledgement", () => {
    it("confirms unconfirmed ack (confirmed=true, version bumped)", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      const result = await confirmAcknowledgement(
        asDb(db),
        systemId,
        created.id,
        {},
        auth,
        noopAudit,
      );

      expect(result.confirmed).toBe(true);
      expect(result.version).toBe(2);
      expect(result.id).toBe(created.id);
    });

    it("updates encryptedData when provided on confirm", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );
      const distinctBlob = testBlob(new Uint8Array([7, 8, 9]));
      const newData = Buffer.from(serializeEncryptedBlob(distinctBlob)).toString("base64");

      const result = await confirmAcknowledgement(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: newData },
        auth,
        noopAudit,
      );

      expect(result.confirmed).toBe(true);
      expect(result.encryptedData).not.toBe(created.encryptedData);
    });

    it("is idempotent — re-confirm returns same state with no duplicate audit", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const first = await confirmAcknowledgement(asDb(db), systemId, created.id, {}, auth, audit);
      const second = await confirmAcknowledgement(asDb(db), systemId, created.id, {}, auth, audit);

      expect(second.confirmed).toBe(true);
      expect(second.version).toBe(first.version);
      // Only one audit event from the first confirm — second is idempotent
      expect(audit.calls).toHaveLength(1);
    });

    it("writes audit event acknowledgement.confirmed (only on first confirm)", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await confirmAcknowledgement(asDb(db), systemId, created.id, {}, auth, audit);

      expectSingleAuditEvent(audit, "acknowledgement.confirmed");
    });

    it("returns NOT_FOUND when ack does not exist", async () => {
      await assertApiError(
        confirmAcknowledgement(asDb(db), systemId, genAcknowledgementId(), {}, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND when ack is archived", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );
      await archiveAcknowledgement(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        confirmAcknowledgement(asDb(db), systemId, created.id, {}, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe("getAcknowledgement", () => {
    it("returns full result for existing ack", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      const result = await getAcknowledgement(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
    });

    it("returns NOT_FOUND for nonexistent ID", async () => {
      await assertApiError(
        getAcknowledgement(asDb(db), systemId, genAcknowledgementId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listAcknowledgements", () => {
    it("lists all non-archived by default", async () => {
      await createAcknowledgement(asDb(db), systemId, makeCreateParams(), auth, noopAudit);
      await createAcknowledgement(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const result = await listAcknowledgements(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("filters by confirmed=true", async () => {
      const ack = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );
      await createAcknowledgement(asDb(db), systemId, makeCreateParams(), auth, noopAudit);
      await confirmAcknowledgement(asDb(db), systemId, ack.id, {}, auth, noopAudit);

      const result = await listAcknowledgements(asDb(db), systemId, auth, { confirmed: true });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.confirmed).toBe(true);
    });

    it("filters by confirmed=false (pending)", async () => {
      const ack = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );
      await createAcknowledgement(asDb(db), systemId, makeCreateParams(), auth, noopAudit);
      await confirmAcknowledgement(asDb(db), systemId, ack.id, {}, auth, noopAudit);

      const result = await listAcknowledgements(asDb(db), systemId, auth, { confirmed: false });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.confirmed).toBe(false);
    });

    it("includes archived when includeArchived=true", async () => {
      const ack = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );
      await archiveAcknowledgement(asDb(db), systemId, ack.id, auth, noopAudit);

      const result = await listAcknowledgements(asDb(db), systemId, auth, {
        includeArchived: true,
      });
      expect(result.data.some((item) => item.id === ack.id)).toBe(true);
    });

    it("supports cursor pagination (newest first)", async () => {
      for (let i = 0; i < 3; i++) {
        await createAcknowledgement(asDb(db), systemId, makeCreateParams(), auth, noopAudit);
      }

      const page1 = await listAcknowledgements(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listAcknowledgements(asDb(db), systemId, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);

      const allIds = [...page1.data.map((a) => a.id), ...page2.data.map((a) => a.id)];
      expect(new Set(allIds).size).toBe(3);
    });
  });

  // ── ARCHIVE / RESTORE ──────────────────────────────────────────

  describe("archiveAcknowledgement", () => {
    it("archives successfully", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await archiveAcknowledgement(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(
        getAcknowledgement(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
      expect(audit.calls[0]?.eventType).toBe("acknowledgement.archived");
    });

    it("returns ALREADY_ARCHIVED when already archived", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );
      await archiveAcknowledgement(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        archiveAcknowledgement(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });

    it("returns NOT_FOUND when does not exist", async () => {
      await assertApiError(
        archiveAcknowledgement(asDb(db), systemId, genAcknowledgementId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("restoreAcknowledgement", () => {
    it("restores archived ack", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );
      await archiveAcknowledgement(asDb(db), systemId, created.id, auth, noopAudit);

      const audit = spyAudit();
      const restored = await restoreAcknowledgement(asDb(db), systemId, created.id, auth, audit);

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.id).toBe(created.id);
      expect(restored.version).toBe(3);
      expectSingleAuditEvent(audit, "acknowledgement.restored");
    });

    it("returns NOT_ARCHIVED when ack is not archived", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      await assertApiError(
        restoreAcknowledgement(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
      );
    });

    it("returns NOT_FOUND when does not exist", async () => {
      await assertApiError(
        restoreAcknowledgement(asDb(db), systemId, genAcknowledgementId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── CROSS-SYSTEM ISOLATION ──────────────────────────────────────

  describe("cross-system isolation", () => {
    it("cannot access another system's acknowledgement by ID", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      await assertApiError(
        getAcknowledgement(asDb(db), otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });

    it("list does not return another system's acknowledgements", async () => {
      await createAcknowledgement(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      const result = await listAcknowledgements(asDb(db), otherSystemId, otherAuth);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────

  describe("deleteAcknowledgement", () => {
    it("hard deletes the ack", async () => {
      const created = await createAcknowledgement(
        asDb(db),
        systemId,
        makeCreateParams(),
        auth,
        noopAudit,
      );

      await deleteAcknowledgement(asDb(db), systemId, created.id, auth, noopAudit);
      await assertApiError(
        getAcknowledgement(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND when does not exist", async () => {
      await assertApiError(
        deleteAcknowledgement(asDb(db), systemId, genAcknowledgementId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });
});
