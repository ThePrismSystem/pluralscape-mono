import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archivePoll,
  closePoll,
  createPoll,
  deletePoll,
  getPoll,
  listPolls,
  restorePoll,
  updatePoll,
} from "../../services/poll.service.js";
import {
  assertApiError,
  asDb,
  genPollId,
  genPollVoteId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { polls, pollVotes } = schema;

function makeCreateParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    encryptedData: testEncryptedDataBase64(),
    kind: "standard",
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    ...overrides,
  };
}

describe("poll.service (PGlite integration)", () => {
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

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    const memId = `mem_${crypto.randomUUID()}`;
    memberId = await pgInsertMember(db, systemId, memId);
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(pollVotes);
    await db.delete(polls);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createPoll", () => {
    it("creates a poll with expected shape (status=open, version=1)", async () => {
      const audit = spyAudit();
      const result = await createPoll(asDb(db), systemId, makeCreateParams(), auth, audit);

      expect(result.id).toMatch(/^poll_/);
      expect(result.systemId).toBe(systemId);
      expect(result.createdByMemberId).toBeNull();
      expect(result.kind).toBe("standard");
      expect(result.status).toBe("open");
      expect(result.closedAt).toBeNull();
      expect(result.endsAt).toBeNull();
      expect(result.allowMultipleVotes).toBe(false);
      expect(result.maxVotesPerMember).toBe(1);
      expect(result.allowAbstain).toBe(false);
      expect(result.allowVeto).toBe(false);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
      expect(result.encryptedData).toEqual(expect.any(String));
      expect(result.createdAt).toEqual(expect.any(Number));
      expect(result.updatedAt).toEqual(expect.any(Number));
    });

    it("creates with createdByMemberId", async () => {
      const result = await createPoll(
        asDb(db),
        systemId,
        makeCreateParams({ createdByMemberId: memberId }),
        auth,
        noopAudit,
      );

      expect(result.createdByMemberId).toBe(memberId);
    });

    it("creates with endsAt", async () => {
      const endsAt = Date.now() + 86_400_000;
      const result = await createPoll(
        asDb(db),
        systemId,
        makeCreateParams({ endsAt }),
        auth,
        noopAudit,
      );

      expect(result.endsAt).toBe(endsAt);
    });

    it("writes audit event poll.created", async () => {
      const audit = spyAudit();
      await createPoll(asDb(db), systemId, makeCreateParams(), auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll.created");
    });

    it("rejects creation with allowMultipleVotes=false and maxVotesPerMember > 1", async () => {
      await assertApiError(
        createPoll(
          asDb(db),
          systemId,
          makeCreateParams({ allowMultipleVotes: false, maxVotesPerMember: 3 }),
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe("getPoll", () => {
    it("retrieves a created poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const result = await getPoll(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
    });

    it("returns NOT_FOUND for nonexistent ID", async () => {
      await assertApiError(getPoll(asDb(db), systemId, genPollId(), auth), "NOT_FOUND", 404);
    });

    it("returns NOT_FOUND for archived poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(getPoll(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listPolls", () => {
    it("supports cursor pagination (newest first)", async () => {
      for (let i = 0; i < 3; i++) {
        await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);
      }

      const page1 = await listPolls(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listPolls(asDb(db), systemId, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);

      const allIds = [...page1.items.map((p) => p.id), ...page2.items.map((p) => p.id)];
      expect(new Set(allIds).size).toBe(3);
    });

    it("filters by status", async () => {
      const poll = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);
      await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await closePoll(asDb(db), systemId, poll.id, auth, noopAudit);

      const openResult = await listPolls(asDb(db), systemId, auth, { status: "open" });
      expect(openResult.items).toHaveLength(1);
      expect(openResult.items[0]?.status).toBe("open");

      const closedResult = await listPolls(asDb(db), systemId, auth, { status: "closed" });
      expect(closedResult.items).toHaveLength(1);
      expect(closedResult.items[0]?.status).toBe("closed");
    });

    it("includes archived when includeArchived=true", async () => {
      const poll = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, poll.id, auth, noopAudit);

      const result = await listPolls(asDb(db), systemId, auth, { includeArchived: true });
      expect(result.items.some((item) => item.id === poll.id)).toBe(true);
    });

    it("respects limit", async () => {
      for (let i = 0; i < 5; i++) {
        await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);
      }

      const result = await listPolls(asDb(db), systemId, auth, { limit: 3 });
      expect(result.items).toHaveLength(3);
      expect(result.hasMore).toBe(true);
    });

    it("returns empty list when no polls", async () => {
      const result = await listPolls(asDb(db), systemId, auth);
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns INVALID_CURSOR for garbage cursor string", async () => {
      await assertApiError(
        listPolls(asDb(db), systemId, auth, { cursor: "not-a-valid-cursor" }),
        "INVALID_CURSOR",
        400,
      );
    });
  });

  // ── UPDATE ──────────────────────────────────────────────────────

  describe("updatePoll", () => {
    it("updates encryptedData with OCC version bump", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const audit = spyAudit();
      const result = await updatePoll(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(result.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("poll.updated");
    });

    it("returns CONFLICT on stale version", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await updatePoll(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updatePoll(
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

    it("returns NOT_FOUND for nonexistent poll", async () => {
      await assertApiError(
        updatePoll(
          asDb(db),
          systemId,
          genPollId(),
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("returns POLL_CLOSED when poll is closed", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await closePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        updatePoll(
          asDb(db),
          systemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 2 },
          auth,
          noopAudit,
        ),
        "POLL_CLOSED",
        409,
      );
    });

    it("returns NOT_FOUND for archived poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        updatePoll(
          asDb(db),
          systemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 2 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event poll.updated", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const audit = spyAudit();
      await updatePoll(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll.updated");
    });
  });

  // ── CLOSE ──────────────────────────────────────────────────────

  describe("closePoll", () => {
    it("sets status=closed, closedAt, and bumps version", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const result = await closePoll(asDb(db), systemId, created.id, auth, noopAudit);

      expect(result.status).toBe("closed");
      expect(result.closedAt).toEqual(expect.any(Number));
      expect(result.version).toBe(2);
    });

    it("returns POLL_CLOSED when already closed", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await closePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        closePoll(asDb(db), systemId, created.id, auth, noopAudit),
        "POLL_CLOSED",
        409,
      );
    });

    it("returns NOT_FOUND for nonexistent poll", async () => {
      await assertApiError(
        closePoll(asDb(db), systemId, genPollId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND for archived poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        closePoll(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND for archived+closed poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await closePoll(asDb(db), systemId, created.id, auth, noopAudit);
      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        closePoll(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event poll.closed", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const audit = spyAudit();
      await closePoll(asDb(db), systemId, created.id, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll.closed");
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────

  describe("deletePoll", () => {
    it("deletes poll with no votes", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const audit = spyAudit();
      await deletePoll(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getPoll(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("poll.deleted");
    });

    it("returns HAS_DEPENDENTS when votes exist", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      // Insert a vote row directly
      await db.insert(pollVotes).values({
        id: genPollVoteId(),
        pollId: created.id,
        systemId,
        encryptedData: testBlob(),
        createdAt: Date.now(),
      });

      const err = await assertApiError(
        deletePoll(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      expect(err.details).toEqual({
        dependents: [{ type: "pollVotes", count: 1 }],
      });
    });

    it("returns NOT_FOUND for nonexistent poll", async () => {
      await assertApiError(
        deletePoll(asDb(db), systemId, genPollId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND for archived poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        deletePoll(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event poll.deleted", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const audit = spyAudit();
      await deletePoll(asDb(db), systemId, created.id, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll.deleted");
    });
  });

  // ── ARCHIVE / RESTORE ──────────────────────────────────────────

  describe("archivePoll", () => {
    it("archives active poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const audit = spyAudit();
      await archivePoll(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getPoll(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("poll.archived");
    });

    it("returns ALREADY_ARCHIVED", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        archivePoll(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });

    it("returns NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        archivePoll(asDb(db), systemId, genPollId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event poll.archived", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      const audit = spyAudit();
      await archivePoll(asDb(db), systemId, created.id, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll.archived");
    });
  });

  describe("restorePoll", () => {
    it("restores archived poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);
      const audit = spyAudit();
      const restored = await restorePoll(asDb(db), systemId, created.id, auth, audit);

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.id).toBe(created.id);
      expect(restored.version).toBe(3);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll.restored");
    });

    it("returns NOT_ARCHIVED for active poll", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await assertApiError(
        restorePoll(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
      );
    });

    it("returns NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        restorePoll(asDb(db), systemId, genPollId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event poll.restored", async () => {
      const created = await createPoll(asDb(db), systemId, makeCreateParams(), auth, noopAudit);

      await archivePoll(asDb(db), systemId, created.id, auth, noopAudit);
      const audit = spyAudit();
      await restorePoll(asDb(db), systemId, created.id, auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll.restored");
    });
  });
});
