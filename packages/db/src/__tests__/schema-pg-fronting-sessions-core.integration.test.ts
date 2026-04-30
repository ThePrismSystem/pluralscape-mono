import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { customFronts, frontingSessions } from "../schema/pg/fronting.js";
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
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

describe("PG fronting schema — sessions core", () => {
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

  describe("fronting_sessions — core", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        endTime: toUnixMillis(now + 60000),
        memberId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.startTime).toBe(now);
      expect(rows[0]?.endTime).toBe(now + 60000);
    });

    it("allows nullable endTime for open sessions", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.endTime).toBeNull();
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId } = await insertFrontingSession(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(frontingSessions)
        .where(eq(frontingSessions.id, sessionId));
      expect(rows).toHaveLength(0);
    });

    it("rejects duplicate composite PK (id, startTime)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id: sessionId, startTime } = await insertFrontingSession(systemId);
      const memberId = await insertMember(systemId);

      await expect(
        db.insert(frontingSessions).values({
          id: sessionId,
          systemId,
          startTime,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: fixtureNow(),
          updatedAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("allows same id with different startTime (composite PK)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: toUnixMillis(now + 60000),
        memberId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: toUnixMillis(now + 60000),
        updatedAt: toUnixMillis(now + 60000),
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows).toHaveLength(2);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = fixtureNow();
      await expect(
        db.insert(frontingSessions).values({
          id: brandId<FrontingSessionId>(crypto.randomUUID()),
          systemId: brandId<SystemId>("nonexistent"),
          startTime: now,
          memberId: brandId<MemberId>("nonexistent-member"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects endTime <= startTime via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(frontingSessions).values({
          id: brandId<FrontingSessionId>(crypto.randomUUID()),
          systemId,
          startTime: now,
          endTime: now,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();

      await expect(
        db.insert(frontingSessions).values({
          id: brandId<FrontingSessionId>(crypto.randomUUID()),
          systemId,
          startTime: now,
          endTime: toUnixMillis(now - 1000),
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows overlapping sessions for the same system", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      const id1 = brandId<FrontingSessionId>(crypto.randomUUID());
      const id2 = brandId<FrontingSessionId>(crypto.randomUUID());

      await db.insert(frontingSessions).values({
        id: id1,
        systemId,
        startTime: now,
        endTime: toUnixMillis(now + 60000),
        memberId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(frontingSessions).values({
        id: id2,
        systemId,
        startTime: toUnixMillis(now + 30000),
        endTime: toUnixMillis(now + 90000),
        memberId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(frontingSessions)
        .where(eq(frontingSessions.systemId, systemId));
      expect(rows).toHaveLength(2);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const cfId = await insertCustomFront(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      const entityTypeId = crypto.randomUUID();
      const entityId = brandId<SystemStructureEntityId>(crypto.randomUUID());
      await client.query(
        "INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 1, false)",
        [entityTypeId, systemId, now, now],
      );
      await client.query(
        "INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES ($1, $2, $3, 0, '\\x0102'::bytea, $4, $5, 1, false)",
        [entityId, systemId, entityTypeId, now, now],
      );

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        memberId,
        customFrontId: cfId,
        structureEntityId: entityId,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.customFrontId).toBe(cfId);
      expect(rows[0]?.structureEntityId).toBe(entityId);
    });

    it("defaults T3 metadata columns to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const customFrontId = await insertCustomFront(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        customFrontId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.customFrontId).toBe(customFrontId);
      expect(rows[0]?.structureEntityId).toBeNull();
    });

    it("restricts member deletion when referenced by fronting session", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
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
      const now = fixtureNow();

      await expect(
        db.insert(frontingSessions).values({
          id: brandId<FrontingSessionId>(crypto.randomUUID()),
          systemId,
          startTime: now,
          memberId: brandId<MemberId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("restricts custom front deletion when referenced by fronting session", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const customFrontId = await insertCustomFront(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        customFrontId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.delete(customFronts).where(eq(customFronts.id, customFrontId)),
      ).rejects.toThrow();
    });

    it("rejects nonexistent customFrontId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(frontingSessions).values({
          id: brandId<FrontingSessionId>(crypto.randomUUID()),
          systemId,
          startTime: now,
          customFrontId: brandId<CustomFrontId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects version < 1 via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO fronting_sessions (id, system_id, start_time, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, 0)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects fronting session with no subject", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO fronting_sessions (id, system_id, start_time, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("accepts fronting session with only customFrontId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const customFrontId = await insertCustomFront(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        customFrontId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.customFrontId).toBe(customFrontId);
    });
  });
});
