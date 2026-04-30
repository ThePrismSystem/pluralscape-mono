import { brandId, toUnixMillis } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { frontingComments, frontingSessions } from "../schema/pg/fronting.js";
import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearFrontingTables,
  insertAccount as insertAccountWith,
  insertCustomFront as insertCustomFrontWith,
  insertFrontingSession as insertFrontingSessionWith,
  insertMember as insertMemberWith,
  insertSystem as insertSystemWith,
  setupFrontingFixture,
  teardownFrontingFixture,
  type FrontingDb,
} from "./helpers/fronting-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type {
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  ServerInternal,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

describe("PG fronting schema — comments", () => {
  let client: PGlite;
  let db: FrontingDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertMember = (systemId: SystemId, id?: string) => insertMemberWith(db, systemId, id);
  const insertCustomFront = (systemId: string, raw?: string) =>
    insertCustomFrontWith(db, systemId, raw);
  const insertFrontingSession = (systemId: SystemId, id?: string) =>
    insertFrontingSessionWith(db, systemId, id);

  beforeAll(async () => {
    const fixture = await setupFrontingFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownFrontingFixture({ client, db });
  });

  afterEach(async () => {
    await clearFrontingTables(db);
  });

  describe("fronting_comments", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.frontingSessionId).toBe(sessionId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("restricts session deletion when referenced by comment", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const commentId = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id: commentId,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db
          .delete(frontingSessions)
          .where(
            and(
              eq(frontingSessions.id, sessionId),
              eq(frontingSessions.startTime, sessionStartTime),
            ),
          ),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const commentId = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id: commentId,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(frontingComments)
        .where(eq(frontingComments.id, commentId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent sessionId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(frontingComments).values({
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: brandId<FrontingSessionId>("nonexistent"),
          systemId,
          sessionStartTime: now as ServerInternal<UnixMillis>,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects mismatched sessionStartTime FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(frontingComments).values({
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: sessionId,
          systemId,
          sessionStartTime: toUnixMillis(sessionStartTime + 99999) as ServerInternal<UnixMillis>,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips memberId T3 column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        memberId,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.memberId).toBe(memberId);
    });

    it("defaults memberId to null when customFrontId is provided", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const customFrontId = await insertCustomFront(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        customFrontId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.memberId).toBeNull();
    });

    it("restricts member deletion when referenced by comment", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("rejects nonexistent memberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(frontingComments).values({
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: sessionId,
          systemId,
          sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
          memberId: brandId<MemberId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const id = brandId<FrontingCommentId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingComments).values({
        id,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime: sessionStartTime as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = fixtureNow();
      await db
        .update(frontingComments)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(frontingComments.id, id));
      const rows = await db.select().from(frontingComments).where(eq(frontingComments.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO fronting_comments (id, fronting_session_id, system_id, session_start_time, member_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, $5, '\\x0102'::bytea, $6, $7, 1, true, NULL)",
          [crypto.randomUUID(), sessionId, systemId, sessionStartTime, memberId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const { id: sessionId, startTime: sessionStartTime } = await insertFrontingSession(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO fronting_comments (id, fronting_session_id, system_id, session_start_time, member_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, $5, '\\x0102'::bytea, $6, $7, 1, false, $8)",
          [crypto.randomUUID(), sessionId, systemId, sessionStartTime, memberId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
