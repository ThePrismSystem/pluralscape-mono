import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));

import { archiveFrontingSession } from "../../../services/fronting-session/lifecycle.js";
import { createFrontingSession } from "../../../services/fronting-session/create.js";
import {
  getActiveFronting,
  getFrontingSession,
  listFrontingSessions,
  parseFrontingSessionQuery,
} from "../../../services/fronting-session/queries.js";
import { endFrontingSession } from "../../../services/fronting-session/update.js";
import {
  assertApiError,
  genCustomFrontId,
  genFrontingSessionId,
  genMemberId,
  makeAuth,
  noopAudit,
  spyAudit,
  testBlob,
  testEncryptedDataBase64,
  asDb,
} from "../../helpers/integration-setup.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  AccountId,
  CustomFrontId,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { z } from "zod/v4";

const { members, customFronts, frontingSessions, frontingComments } = schema;

describe("fronting-session.service (PGlite integration) — create, list, get", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let memberId: MemberId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgFrontingTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    memberId = genMemberId();
    await pgInsertMember(db, systemId, memberId);

    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(frontingComments);
    await db.delete(frontingSessions);
    await db.delete(customFronts);
    await db.delete(members).where(ne(members.id, memberId));
  });

  async function insertCustomFront(sysId = systemId): Promise<string> {
    const id = genCustomFrontId();
    const now = toUnixMillis(Date.now());
    await db.insert(customFronts).values({
      id,
      systemId: sysId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  type CreateBody = z.infer<typeof CreateFrontingSessionBodySchema>;

  function createParams(overrides: Partial<CreateBody> = {}): CreateBody {
    return {
      encryptedData: testEncryptedDataBase64(),
      startTime: toUnixMillis(Date.now()),
      memberId,
      customFrontId: undefined,
      structureEntityId: undefined,
      ...overrides,
    };
  }

  // ── createFrontingSession ─────────────────────────────────────────

  describe("createFrontingSession", () => {
    it("creates a session with a member subject", async () => {
      const audit = spyAudit();
      const result = await createFrontingSession(asDb(db), systemId, createParams(), auth, audit);

      expect(result.id).toMatch(/^fs_/);
      expect(result.systemId).toBe(systemId);
      expect(result.memberId).toBe(memberId);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("fronting-session.created");
      expect(audit.calls[0]?.actor).toEqual({ kind: "account", id: auth.accountId });
    });

    it("creates a session with a custom front subject", async () => {
      const cfId = await insertCustomFront();
      const result = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ memberId: undefined, customFrontId: brandId<CustomFrontId>(cfId) }),
        auth,
        noopAudit,
      );

      expect(result.customFrontId).toBe(cfId);
      expect(result.memberId).toBeNull();
    });

    it("rejects invalid subject ID (member not in system)", async () => {
      const unknownMemberId = genMemberId();
      await assertApiError(
        createFrontingSession(
          asDb(db),
          systemId,
          createParams({ memberId: unknownMemberId }),
          auth,
          noopAudit,
        ),
        "INVALID_SUBJECT",
        400,
        "not found",
      );
    });

    it("rejects archived member as subject", async () => {
      const archivedMemberId = genMemberId();
      const now = toUnixMillis(Date.now());
      await db.insert(members).values({
        id: archivedMemberId,
        systemId,
        encryptedData: testBlob(),
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await assertApiError(
        createFrontingSession(
          asDb(db),
          systemId,
          createParams({ memberId: archivedMemberId }),
          auth,
          noopAudit,
        ),
        "INVALID_SUBJECT",
        400,
        "not found",
      );
    });

    it("stores encrypted blob and returns base64 data", async () => {
      const result = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      expect(typeof result.encryptedData).toBe("string");
      expect(result.encryptedData.length).toBeGreaterThan(0);
    });
  });

  // ── listFrontingSessions ──────────────────────────────────────────

  describe("listFrontingSessions", () => {
    it("returns sessions ordered by id desc", async () => {
      await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: toUnixMillis(Date.now()) - 2000 }),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: toUnixMillis(Date.now()) - 1000 }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(asDb(db), systemId, auth);

      expect(result.data.length).toBe(2);
      // Verify descending order by string comparison
      const first = result.data[0]?.id ?? "";
      const second = result.data[1]?.id ?? "";
      expect(first > second).toBe(true);
    });

    it("filters by memberId", async () => {
      const otherMemberId = genMemberId();
      await pgInsertMember(db, systemId, otherMemberId);
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);
      const filtered = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ memberId: otherMemberId }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(asDb(db), systemId, auth, {
        memberId: otherMemberId,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0]?.id).toBe(filtered.id);
      expect(result.data[0]?.memberId).toBe(otherMemberId);
    });

    it("filters by customFrontId", async () => {
      const cfId = await insertCustomFront();
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);
      const filtered = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ memberId: undefined, customFrontId: brandId<CustomFrontId>(cfId) }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(asDb(db), systemId, auth, {
        customFrontId: brandId<CustomFrontId>(cfId),
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0]?.id).toBe(filtered.id);
      expect(result.data[0]?.customFrontId).toBe(cfId);
    });

    it("filters activeOnly (no endTime)", async () => {
      const s1 = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: toUnixMillis(Date.now()) - 5000 }),
        auth,
        noopAudit,
      );
      const s2 = await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);

      await endFrontingSession(
        asDb(db),
        systemId,
        s1.id,
        { endTime: toUnixMillis(Date.now()), version: 1 },
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(asDb(db), systemId, auth, {
        activeOnly: true,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0]?.id).toBe(s2.id);
    });

    it("excludes archived by default", async () => {
      const s1 = await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);
      await archiveFrontingSession(asDb(db), systemId, s1.id, auth, noopAudit);
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);

      const result = await listFrontingSessions(asDb(db), systemId, auth);
      expect(result.data.length).toBe(1);
    });

    it("includes archived when includeArchived=true", async () => {
      const s1 = await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);
      await archiveFrontingSession(asDb(db), systemId, s1.id, auth, noopAudit);
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);

      const result = await listFrontingSessions(asDb(db), systemId, auth, {
        includeArchived: true,
      });
      expect(result.data.length).toBe(2);
    });

    it("supports cursor pagination", async () => {
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);

      const page1 = await listFrontingSessions(asDb(db), systemId, auth, {
        limit: 1,
      });

      expect(page1.data.length).toBe(1);
      expect(page1.hasMore).toBe(true);

      const firstId = page1.data[0]?.id;
      expect(typeof firstId).toBe("string");

      // Use the first page's item ID as cursor
      const page2 = await listFrontingSessions(asDb(db), systemId, auth, {
        cursor: firstId,
        limit: 1,
      });

      expect(page2.data.length).toBe(1);
      expect(page2.data[0]?.id).not.toBe(firstId);
      expect(page2.hasMore).toBe(false);
    });

    it("filters by startFrom and startUntil", async () => {
      const baseTime = Date.now();
      await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: baseTime - 10000 }),
        auth,
        noopAudit,
      );
      const s2 = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: baseTime }),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: baseTime + 10000 }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(asDb(db), systemId, auth, {
        startFrom: baseTime - 1,
        startUntil: baseTime + 1,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0]?.id).toBe(s2.id);
    });
  });

  // ── getFrontingSession ────────────────────────────────────────────

  describe("getFrontingSession", () => {
    it("returns a session by id with correct field mapping", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      const result = await getFrontingSession(asDb(db), systemId, created.id, auth);

      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
      expect(result.memberId).toBe(memberId);
      expect(typeof result.encryptedData).toBe("string");
      expect(result.encryptedData.length).toBeGreaterThan(0);
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await assertApiError(
        getFrontingSession(asDb(db), systemId, genFrontingSessionId(), auth),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND for archived session", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        getFrontingSession(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("cannot access another system's session", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      await assertApiError(
        getFrontingSession(asDb(db), otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── getActiveFronting ─────────────────────────────────────────────

  describe("getActiveFronting", () => {
    it("returns only active non-archived sessions", async () => {
      await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: toUnixMillis(Date.now()) - 5000 }),
        auth,
        noopAudit,
      );

      const ended = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime: toUnixMillis(Date.now()) - 10000 }),
        auth,
        noopAudit,
      );
      await endFrontingSession(
        asDb(db),
        systemId,
        ended.id,
        { endTime: toUnixMillis(Date.now()), version: 1 },
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(asDb(db), systemId, auth);
      expect(result.sessions.length).toBe(1);
    });

    it("isCofronting=false with single member session", async () => {
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);

      const result = await getActiveFronting(asDb(db), systemId, auth);
      expect(result.isCofronting).toBe(false);
    });

    it("isCofronting=true with multiple member sessions", async () => {
      const otherMemberId = genMemberId();
      await pgInsertMember(db, systemId, otherMemberId);
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);
      await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ memberId: otherMemberId }),
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(asDb(db), systemId, auth);
      expect(result.isCofronting).toBe(true);
    });

    it("isCofronting excludes custom-front-only sessions", async () => {
      const cfId = await insertCustomFront();
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);
      await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ memberId: undefined, customFrontId: brandId<CustomFrontId>(cfId) }),
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(asDb(db), systemId, auth);
      expect(result.sessions.length).toBe(2);
      expect(result.isCofronting).toBe(false);
    });

    it("returns empty entityMemberMap when no structure entities", async () => {
      await createFrontingSession(asDb(db), systemId, createParams(), auth, noopAudit);

      const result = await getActiveFronting(asDb(db), systemId, auth);
      expect(result.entityMemberMap).toEqual({});
    });
  });

  // ── parseFrontingSessionQuery ─────────────────────────────────────

  describe("parseFrontingSessionQuery", () => {
    it("returns defaults for empty query", () => {
      const result = parseFrontingSessionQuery({});
      expect(result.activeOnly).toBe(false);
      expect(result.includeArchived).toBe(false);
      expect(result.memberId).toBeUndefined();
      expect(result.customFrontId).toBeUndefined();
      expect(result.startFrom).toBeUndefined();
      expect(result.startUntil).toBeUndefined();
    });

    it("parses memberId filter", () => {
      const id = genMemberId();
      const result = parseFrontingSessionQuery({ memberId: id });
      expect(result.memberId).toBe(id);
    });

    it("parses activeOnly boolean", () => {
      const result = parseFrontingSessionQuery({ activeOnly: "true" });
      expect(result.activeOnly).toBe(true);
    });

    it("parses startFrom/startUntil timestamps", () => {
      const result = parseFrontingSessionQuery({ startFrom: "1000", startUntil: "2000" });
      expect(result.startFrom).toBe(1000);
      expect(result.startUntil).toBe(2000);
    });

    it("throws VALIDATION_ERROR for invalid startFrom", () => {
      expect(() => parseFrontingSessionQuery({ startFrom: "not-a-number" })).toThrow();
    });
  });
});
