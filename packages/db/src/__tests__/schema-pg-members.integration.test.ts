import { PGlite } from "@electric-sql/pglite";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { members, memberPhotos } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createPgMemberTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, memberPhotos };

describe("PG members schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  async function insertMember(systemId: SystemId, raw = crypto.randomUUID()): Promise<MemberId> {
    const id = brandId<MemberId>(raw);
    const now = fixtureNow();
    await db.insert(members).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgMemberTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(memberPhotos);
    await db.delete(members);
  });

  describe("members", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<MemberId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(members).where(eq(members.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<MemberId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(members).where(eq(members.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<MemberId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(members).where(eq(members.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(members).where(eq(members.id, memberId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = fixtureNow();
      await expect(
        db.insert(members).values({
          id: brandId<MemberId>(crypto.randomUUID()),
          systemId: brandId<SystemId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips empty Uint8Array for encrypted_data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<MemberId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array(0)),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(members).where(eq(members.id, id));
      expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array(0)));
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<MemberId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(members).where(eq(members.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<MemberId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(members)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(members.id, id));

      const rows = await db.select().from(members).where(eq(members.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("updates version and updatedAt correctly", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<MemberId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const later = toUnixMillis(now + 1000);
      await db
        .update(members)
        .set({ version: sql`${members.version} + 1`, updatedAt: later })
        .where(eq(members.id, id));

      const rows = await db.select().from(members).where(eq(members.id, id));
      expect(rows[0]?.version).toBe(2);
      expect(rows[0]?.updatedAt).toBe(later);
    });

    it("rejects version < 1 via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO members (id, system_id, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 0)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO members (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO members (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("member_photos", () => {
    it("inserts with encrypted_data and sort_order", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<MemberPhotoId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([100, 200]));

      await db.insert(memberPhotos).values({
        id,
        memberId,
        systemId,
        sortOrder: 1,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sortOrder).toBe(1);
    });

    it("defaults sort_order to 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<MemberPhotoId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(memberPhotos).values({
        id,
        memberId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, id));
      expect(rows[0]?.sortOrder).toBe(0);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<MemberPhotoId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(memberPhotos).values({
        id,
        memberId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("restricts member deletion when referenced by photo", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await db.insert(memberPhotos).values({
        id: brandId<MemberPhotoId>(crypto.randomUUID()),
        memberId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const photoId = brandId<MemberPhotoId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(memberPhotos).values({
        id: photoId,
        memberId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, photoId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent memberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(memberPhotos).values({
          id: brandId<MemberPhotoId>(crypto.randomUUID()),
          memberId: brandId<MemberId>("nonexistent"),
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent systemId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(memberPhotos).values({
          id: brandId<MemberPhotoId>(crypto.randomUUID()),
          memberId,
          systemId: brandId<SystemId>("nonexistent"),
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
      const id = brandId<MemberPhotoId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(memberPhotos).values({
        id,
        memberId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<MemberPhotoId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(memberPhotos).values({
        id,
        memberId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<MemberPhotoId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(memberPhotos).values({
        id,
        memberId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(memberPhotos)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(memberPhotos.id, id));

      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO member_photos (id, member_id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, 1, true, NULL)",
          [crypto.randomUUID(), memberId, systemId, now, now],
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
          "INSERT INTO member_photos (id, member_id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, 1, false, $6)",
          [crypto.randomUUID(), memberId, systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
