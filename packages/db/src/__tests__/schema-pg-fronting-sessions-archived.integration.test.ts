import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { frontingSessions } from "../schema/pg/fronting.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearFrontingTables,
  insertAccount as insertAccountWith,
  insertFrontingSession as insertFrontingSessionWith,
  insertMember as insertMemberWith,
  insertSystem as insertSystemWith,
  setupFrontingFixture,
  teardownFrontingFixture,
  type FrontingDb,
} from "./helpers/fronting-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type { FrontingSessionId, SystemId, SystemStructureEntityId } from "@pluralscape/types";

describe("PG fronting schema — sessions archived & structure entity", () => {
  let client: PGlite;
  let db: FrontingDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertMember = (systemId: SystemId, id?: string) => insertMemberWith(db, systemId, id);
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

  describe("fronting_sessions — archived & structure entity", () => {
    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id } = await insertFrontingSession(systemId);

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
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
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const { id, startTime } = await insertFrontingSession(systemId);

      const now = fixtureNow();
      await db
        .update(frontingSessions)
        .set({ archived: true, archivedAt: now })
        .where(and(eq(frontingSessions.id, id), eq(frontingSessions.startTime, startTime)));
      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO fronting_sessions (id, system_id, start_time, member_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, '\\x0102'::bytea, $5, $6, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, memberId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO fronting_sessions (id, system_id, start_time, member_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, '\\x0102'::bytea, $5, $6, 1, false, $7)",
          [crypto.randomUUID(), systemId, now, memberId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("accepts fronting session with only structureEntityId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
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

      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      await db.insert(frontingSessions).values({
        id,
        systemId,
        startTime: now,
        structureEntityId: entityId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(frontingSessions).where(eq(frontingSessions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.customFrontId).toBeNull();
      expect(rows[0]?.structureEntityId).toBe(entityId);
    });

    it("rejects nonexistent structureEntityId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(frontingSessions).values({
          id: brandId<FrontingSessionId>(crypto.randomUUID()),
          systemId,
          startTime: now,
          structureEntityId: brandId<SystemStructureEntityId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("restricts deletion of structure entity with dependent fronting session", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
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
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        systemId,
        startTime: now,
        structureEntityId: entityId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query("DELETE FROM system_structure_entities WHERE id = $1", [entityId]),
      ).rejects.toThrow();
    });
  });

  describe("fronting_sessions indexes", () => {
    it("creates partial index for active fronters", async () => {
      const result = await client.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'fronting_sessions' AND indexname = 'fronting_sessions_active_idx'`,
      );
      const rows = result.rows as Array<{ indexname: string; indexdef: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.indexdef).toMatch(/WHERE.*end_time.*IS NULL/i);
    });
  });
});
