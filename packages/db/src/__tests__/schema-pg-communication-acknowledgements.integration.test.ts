import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { acknowledgements } from "../schema/pg/communication.js";
import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearCommunicationTables,
  insertAccount as insertAccountWith,
  insertMember as insertMemberWith,
  insertSystem as insertSystemWith,
  setupCommunicationFixture,
  teardownCommunicationFixture,
  type CommunicationDb,
} from "./helpers/communication-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type { AcknowledgementId, MemberId } from "@pluralscape/types";

describe("PG communication schema — acknowledgements", () => {
  let client: PGlite;
  let db: CommunicationDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => insertMemberWith(db, systemId, id);

  beforeAll(async () => {
    const fixture = await setupCommunicationFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownCommunicationFixture({ client, db });
  });

  afterEach(async () => {
    await clearCommunicationTables(db);
  });

  describe("acknowledgements", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1, 2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.confirmed).toBe(false);
    });

    it("round-trips confirmed state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        confirmed: true,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.confirmed).toBe(true);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows).toHaveLength(0);
    });

    it("round-trips createdByMemberId T3 column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        createdByMemberId: brandId<MemberId>(memberId),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.createdByMemberId).toBe(memberId);
    });

    it("defaults createdByMemberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("restricts member deletion when referenced by acknowledgement", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        createdByMemberId: brandId<MemberId>(memberId),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("rejects nonexistent createdByMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(acknowledgements).values({
          id: brandId<AcknowledgementId>(crypto.randomUUID()),
          systemId,
          createdByMemberId: brandId<MemberId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(acknowledgements).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(acknowledgements)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(acknowledgements.id, id));

      const rows = await db.select().from(acknowledgements).where(eq(acknowledgements.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $3, true, NULL)",
          [crypto.randomUUID(), systemId, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $3, false, $4)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
