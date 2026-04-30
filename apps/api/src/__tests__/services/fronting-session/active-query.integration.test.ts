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

import { createFrontingSession } from "../../../services/fronting-session/create.js";
import {
  getActiveFronting,
  parseFrontingSessionQuery,
} from "../../../services/fronting-session/queries.js";
import { endFrontingSession } from "../../../services/fronting-session/update.js";
import {
  genCustomFrontId,
  genMemberId,
  makeAuth,
  noopAudit,
  testBlob,
  testEncryptedDataBase64,
  asDb,
} from "../../helpers/integration-setup.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, CustomFrontId, MemberId, SystemId } from "@pluralscape/types";
import type { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { z } from "zod/v4";

const { members, customFronts, frontingSessions, frontingComments } = schema;

describe("fronting-session.service (PGlite integration) — getActiveFronting and parseQuery", () => {
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
