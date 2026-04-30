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

import { createFrontingComment as createComment } from "../../../services/fronting-session/comments/create.js";
import { deleteFrontingComment } from "../../../services/fronting-session/comments/lifecycle.js";
import { createFrontingSession } from "../../../services/fronting-session/create.js";
import {
  archiveFrontingSession,
  deleteFrontingSession,
  restoreFrontingSession,
} from "../../../services/fronting-session/lifecycle.js";
import { getFrontingSession } from "../../../services/fronting-session/queries.js";
import {
  endFrontingSession,
  updateFrontingSession,
} from "../../../services/fronting-session/update.js";
import {
  assertApiError,
  genFrontingCommentId,
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
  MemberId,
  ServerInternal,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { z } from "zod/v4";

const { members, customFronts, frontingSessions, frontingComments } = schema;

describe("fronting-session.service (PGlite integration) — update, end, lifecycle", () => {
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

  // ── updateFrontingSession ─────────────────────────────────────────

  describe("updateFrontingSession", () => {
    it("updates on correct version", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await updateFrontingSession(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      expect(result.version).toBe(2);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      await updateFrontingSession(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateFrontingSession(
          asDb(db),
          systemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await assertApiError(
        updateFrontingSession(
          asDb(db),
          systemId,
          genFrontingSessionId(),
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── endFrontingSession ────────────────────────────────────────────

  describe("endFrontingSession", () => {
    it("ends an active session", async () => {
      const startTime = Date.now() - 5000;
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      const endTime = Date.now();
      const result = await endFrontingSession(
        asDb(db),
        systemId,
        created.id,
        { endTime, version: 1 },
        auth,
        noopAudit,
      );

      expect(result.endTime).toBe(endTime);
      expect(result.version).toBe(2);
    });

    it("throws ALREADY_ENDED for already-ended session", async () => {
      const startTime = Date.now() - 5000;
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      await endFrontingSession(
        asDb(db),
        systemId,
        created.id,
        { endTime: toUnixMillis(Date.now()), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        endFrontingSession(
          asDb(db),
          systemId,
          created.id,
          { endTime: toUnixMillis(Date.now()), version: 2 },
          auth,
          noopAudit,
        ),
        "ALREADY_ENDED",
        400,
      );
    });

    it("rejects endTime <= startTime", async () => {
      const startTime = Date.now();
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      await assertApiError(
        endFrontingSession(
          asDb(db),
          systemId,
          created.id,
          { endTime: startTime - 1, version: 1 },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
        "endTime",
      );
    });

    it("throws CONFLICT on stale version (OCC check)", async () => {
      const startTime = Date.now() - 5000;
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      await updateFrontingSession(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        endFrontingSession(
          asDb(db),
          systemId,
          created.id,
          { endTime: toUnixMillis(Date.now()), version: 1 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await assertApiError(
        endFrontingSession(
          asDb(db),
          systemId,
          genFrontingSessionId(),
          { endTime: toUnixMillis(Date.now()), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── deleteFrontingSession ─────────────────────────────────────────

  describe("deleteFrontingSession", () => {
    it("deletes a session with no comments", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await deleteFrontingSession(asDb(db), systemId, created.id, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("fronting-session.deleted");

      await assertApiError(
        getFrontingSession(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("throws HAS_DEPENDENTS with non-archived comments", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const now = toUnixMillis(Date.now());
      await db.insert(frontingComments).values({
        id: genFrontingCommentId(),
        frontingSessionId: created.id,
        systemId,
        sessionStartTime: toUnixMillis(Number(created.startTime)) as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await assertApiError(
        deleteFrontingSession(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });

    it("succeeds after deleting all comments", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      // Create a real comment via service
      const comment = await createComment(
        asDb(db),
        systemId,
        created.id,
        {
          encryptedData: testEncryptedDataBase64(),
          memberId,
          customFrontId: undefined,
          structureEntityId: undefined,
        },
        auth,
        noopAudit,
      );

      // Delete the comment (while still non-archived)
      await deleteFrontingComment(asDb(db), systemId, created.id, comment.id, auth, noopAudit);

      // Now the session can be deleted
      await deleteFrontingSession(asDb(db), systemId, created.id, auth, noopAudit);
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await assertApiError(
        deleteFrontingSession(asDb(db), systemId, genFrontingSessionId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── archiveFrontingSession / restoreFrontingSession ────────────────

  describe("archiveFrontingSession", () => {
    it("archives and hides session from non-archived queries", async () => {
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

    it("throws ALREADY_ARCHIVED for already-archived session", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        archiveFrontingSession(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });
  });

  describe("restoreFrontingSession", () => {
    it("restores an archived session and increments version", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(asDb(db), systemId, created.id, auth, noopAudit);

      const restored = await restoreFrontingSession(
        asDb(db),
        systemId,
        created.id,
        auth,
        noopAudit,
      );

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.version).toBe(3);
    });

    it("throws for non-archived session", async () => {
      const created = await createFrontingSession(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      await assertApiError(
        restoreFrontingSession(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
      );
    });
  });
});
