import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { members, memberPhotos } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, memberPhotos };

describe("PG members schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  async function insertAccount(id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
    await db.insert(accounts).values({
      id,
      emailHash: `hash_${crypto.randomUUID()}`,
      emailSalt: `salt_${crypto.randomUUID()}`,
      passwordHash: `$argon2id$${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertSystem(accountId: string, id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
    await db.insert(systems).values({
      id,
      accountId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertMember(systemId: string, id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
    await db.insert(members).values({
      id,
      systemId,
      encryptedData: new Uint8Array([1, 2, 3]),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await client.query(`
      CREATE TABLE accounts (
        id VARCHAR(255) PRIMARY KEY,
        email_hash VARCHAR(255) NOT NULL UNIQUE,
        email_salt VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE systems (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_data BYTEA,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE members (
        id VARCHAR(255) PRIMARY KEY,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        encrypted_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        archived BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE member_photos (
        id VARCHAR(255) PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        sort_order INTEGER,
        encrypted_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("members", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30, 40, 50]);

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
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
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
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(members).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
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
  });

  describe("member_photos", () => {
    it("inserts with encrypted_data and sort_order", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([100, 200]);

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

    it("allows nullable sort_order", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(memberPhotos).values({
        id,
        memberId,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, id));
      expect(rows[0]?.sortOrder).toBeNull();
    });

    it("cascades on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const photoId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(memberPhotos).values({
        id: photoId,
        memberId,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, photoId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const photoId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(memberPhotos).values({
        id: photoId,
        memberId,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(memberPhotos).where(eq(memberPhotos.id, photoId));
      expect(rows).toHaveLength(0);
    });
  });
});
