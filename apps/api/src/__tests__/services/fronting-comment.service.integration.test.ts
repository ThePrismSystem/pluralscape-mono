import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));

import {
  archiveFrontingComment,
  createFrontingComment,
  deleteFrontingComment,
  getFrontingComment,
  listFrontingComments,
  restoreFrontingComment,
  updateFrontingComment,
} from "../../services/fronting-comment.service.js";
import {
  archiveFrontingSession,
  createFrontingSession,
} from "../../services/fronting-session.service.js";
import {
  assertApiError,
  genFrontingCommentId,
  genFrontingSessionId,
  genMemberId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
  asDb,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { customFronts, frontingSessions, frontingComments } = schema;

describe("fronting-comment.service (PGlite integration)", () => {
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
    memberId = brandId<MemberId>(await pgInsertMember(db, systemId, genMemberId()));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(frontingComments);
    await db.delete(frontingSessions);
    await db.delete(customFronts);
  });

  async function createSession(): Promise<FrontingSessionId> {
    const result = await createFrontingSession(
      asDb(db),
      systemId,
      {
        encryptedData: testEncryptedDataBase64(),
        startTime: Date.now(),
        memberId,
      },
      auth,
      noopAudit,
    );
    return result.id;
  }

  function commentParams(
    overrides: Partial<{
      encryptedData: string;
      memberId: MemberId;
      customFrontId: CustomFrontId;
    }> = {},
  ) {
    return {
      encryptedData: testEncryptedDataBase64(),
      memberId,
      ...overrides,
    };
  }

  describe("createFrontingComment", () => {
    it("creates a comment on an existing session", async () => {
      const sid = await createSession();
      const audit = spyAudit();
      const result = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        audit,
      );

      expect(result.id).toMatch(/^fcom_/);
      expect(result.frontingSessionId).toBe(sid);
      expect(result.memberId).toBe(memberId);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("fronting-comment.created");
      expect(audit.calls[0]?.actor).toEqual({ kind: "account", id: auth.accountId });
    });

    it("throws NOT_FOUND if parent session does not exist", async () => {
      await assertApiError(
        createFrontingComment(
          asDb(db),
          systemId,
          genFrontingSessionId(),
          commentParams(),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws SESSION_ARCHIVED for archived parent", async () => {
      const sid = await createSession();

      await archiveFrontingSession(asDb(db), systemId, sid, auth, noopAudit);

      await assertApiError(
        createFrontingComment(asDb(db), systemId, sid, commentParams(), auth, noopAudit),
        "SESSION_ARCHIVED",
        400,
      );
    });

    it("validates subject IDs", async () => {
      const sid = await createSession();
      await assertApiError(
        createFrontingComment(
          asDb(db),
          systemId,
          sid,
          commentParams({ memberId: genMemberId() }),
          auth,
          noopAudit,
        ),
        "INVALID_SUBJECT",
        400,
      );
    });
  });

  describe("listFrontingComments", () => {
    it("throws NOT_FOUND if parent session does not exist", async () => {
      await assertApiError(
        listFrontingComments(asDb(db), systemId, genFrontingSessionId(), auth),
        "NOT_FOUND",
        404,
      );
    });

    it("excludes archived by default", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );
      const c2 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingComment(asDb(db), systemId, sid, c1.id, auth, noopAudit);

      const result = await listFrontingComments(asDb(db), systemId, sid, auth);
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.id).toBe(c2.id);
    });

    it("includes archived when includeArchived=true", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );
      await createFrontingComment(asDb(db), systemId, sid, commentParams(), auth, noopAudit);
      await archiveFrontingComment(asDb(db), systemId, sid, c1.id, auth, noopAudit);

      const result = await listFrontingComments(asDb(db), systemId, sid, auth, {
        includeArchived: true,
      });
      expect(result.data.length).toBe(2);
    });

    it("supports cursor pagination by ID desc", async () => {
      const sid = await createSession();
      await createFrontingComment(asDb(db), systemId, sid, commentParams(), auth, noopAudit);
      await createFrontingComment(asDb(db), systemId, sid, commentParams(), auth, noopAudit);

      const page1 = await listFrontingComments(asDb(db), systemId, sid, auth, { limit: 1 });
      expect(page1.data.length).toBe(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await listFrontingComments(asDb(db), systemId, sid, auth, {
        cursor: page1.data[0]?.id,
        limit: 1,
      });
      expect(page2.data.length).toBe(1);
      expect(page2.data[0]?.id).not.toBe(page1.data[0]?.id);
    });
  });

  describe("getFrontingComment", () => {
    it("throws NOT_FOUND if parent session does not exist", async () => {
      await assertApiError(
        getFrontingComment(
          asDb(db),
          systemId,
          genFrontingSessionId(),
          genFrontingCommentId(),
          auth,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND for archived comment", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingComment(asDb(db), systemId, sid, c1.id, auth, noopAudit);

      await assertApiError(
        getFrontingComment(asDb(db), systemId, sid, c1.id, auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("updateFrontingComment", () => {
    it("updates on correct version", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );

      const result = await updateFrontingComment(
        asDb(db),
        systemId,
        sid,
        c1.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );
      expect(result.version).toBe(2);
    });

    it("throws CONFLICT on stale version", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );
      await updateFrontingComment(
        asDb(db),
        systemId,
        sid,
        c1.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );
      await assertApiError(
        updateFrontingComment(
          asDb(db),
          systemId,
          sid,
          c1.id,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });
  });

  describe("deleteFrontingComment", () => {
    it("always succeeds (leaf entity)", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );

      await deleteFrontingComment(asDb(db), systemId, sid, c1.id, auth, noopAudit);

      await assertApiError(
        getFrontingComment(asDb(db), systemId, sid, c1.id, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND for nonexistent comment", async () => {
      const sid = await createSession();
      await assertApiError(
        deleteFrontingComment(asDb(db), systemId, sid, genFrontingCommentId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("archiveFrontingComment / restoreFrontingComment", () => {
    it("archives a comment", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );

      await archiveFrontingComment(asDb(db), systemId, sid, c1.id, auth, noopAudit);

      await assertApiError(
        getFrontingComment(asDb(db), systemId, sid, c1.id, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("restores an archived comment and increments version", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        asDb(db),
        systemId,
        sid,
        commentParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingComment(asDb(db), systemId, sid, c1.id, auth, noopAudit);

      const restored = await restoreFrontingComment(
        asDb(db),
        systemId,
        sid,
        c1.id,
        auth,
        noopAudit,
      );
      expect(restored.archived).toBe(false);
      expect(restored.version).toBe(3);
    });
  });
});
