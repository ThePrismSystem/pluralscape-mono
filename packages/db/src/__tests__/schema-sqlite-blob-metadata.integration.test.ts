import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { blobMetadata } from "../schema/sqlite/blob-metadata.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteBlobMetadataTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BlobId, BucketId, ChecksumHex } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, buckets, blobMetadata };

describe("SQLite blob_metadata schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteBlobMetadataTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(blobMetadata).run();
  });

  it("round-trips all fields", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    db.insert(blobMetadata)
      .values({
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        mimeType: "image/png",
        sizeBytes: 1024,
        encryptionTier: 1,
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      })
      .run();

    const rows = db.select().from(blobMetadata).where(eq(blobMetadata.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.mimeType).toBe("image/png");
    expect(rows[0]?.sizeBytes).toBe(1024);
    expect(rows[0]?.encryptionTier).toBe(1);
    expect(rows[0]?.purpose).toBe("avatar");
    expect(rows[0]?.thumbnailOfBlobId).toBeNull();
    expect(rows[0]?.bucketId).toBeNull();
  });

  it("enforces unique storage_key", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const storageKey = `blobs/${crypto.randomUUID()}`;
    const now = fixtureNow();

    db.insert(blobMetadata)
      .values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "attachment",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      })
      .run();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: brandId<BlobId>(crypto.randomUUID()),
          systemId,
          storageKey,
          sizeBytes: 200,
          encryptionTier: 1,
          purpose: "attachment",
          checksum: brandId<ChecksumHex>("a".repeat(64)),
          createdAt: now,
          uploadedAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("cascades on system deletion", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    db.insert(blobMetadata)
      .values({
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 2,
        purpose: "member-photo",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db.select().from(blobMetadata).where(eq(blobMetadata.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("restricts bucket deletion when referenced by blob metadata", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const bucketId = brandId<BucketId>(crypto.randomUUID());
    const now = fixtureNow();

    db.insert(buckets)
      .values({
        id: bucketId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(blobMetadata)
      .values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "attachment",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        bucketId,
        createdAt: now,
        uploadedAt: now,
      })
      .run();

    expect(() => db.delete(buckets).where(eq(buckets.id, bucketId)).run()).toThrow(
      /FOREIGN KEY|constraint/i,
    );
  });

  it("rejects invalid purpose", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          100,
          1,
          "invalid-purpose",
          "a".repeat(64),
          now,
        ),
    ).toThrow();
  });

  it("rejects sizeBytes <= 0", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: brandId<BlobId>(crypto.randomUUID()),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: 0,
          encryptionTier: 1,
          purpose: "avatar",
          checksum: brandId<ChecksumHex>("a".repeat(64)),
          createdAt: now,
          uploadedAt: now,
        })
        .run(),
    ).toThrow();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: brandId<BlobId>(crypto.randomUUID()),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: -1,
          encryptionTier: 1,
          purpose: "avatar",
          checksum: brandId<ChecksumHex>("a".repeat(64)),
          createdAt: now,
          uploadedAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("rejects invalid encryptionTier", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    // Use raw SQL to bypass TypeScript EncryptionTier type and test DB CHECK constraint
    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          100,
          0,
          "avatar",
          "a".repeat(64),
          now,
        ),
    ).toThrow();

    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          100,
          3,
          "avatar",
          "a".repeat(64),
          now,
        ),
    ).toThrow();
  });

  it("rejects null checksum", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    // Use raw SQL to bypass Drizzle's type checking and test the DB constraint
    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .run(id, systemId, `blobs/${crypto.randomUUID()}`, 100, 1, "avatar", now),
    ).toThrow();
  });

  it("rejects checksum not exactly 64 characters", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: brandId<BlobId>(crypto.randomUUID()),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: 100,
          encryptionTier: 1,
          purpose: "avatar",
          checksum: brandId<ChecksumHex>("a".repeat(63)),
          createdAt: now,
          uploadedAt: now,
        })
        .run(),
    ).toThrow(/CHECK|constraint/i);

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: brandId<BlobId>(crypto.randomUUID()),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: 100,
          encryptionTier: 1,
          purpose: "avatar",
          checksum: brandId<ChecksumHex>("a".repeat(65)),
          createdAt: now,
          uploadedAt: now,
        })
        .run(),
    ).toThrow(/CHECK|constraint/i);
  });

  it("accepts size_bytes at exactly 10 GB", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          10737418240,
          1,
          "avatar",
          "a".repeat(64),
          now,
          now,
        ),
    ).not.toThrow();
  });

  it("rejects size_bytes exceeding 10 GB", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          10737418241,
          1,
          "avatar",
          "a".repeat(64),
          now,
        ),
    ).toThrow(/CHECK|constraint/i);
  });

  it("defaults archived to false and archivedAt to null", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    db.insert(blobMetadata)
      .values({
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      })
      .run();

    const rows = db.select().from(blobMetadata).where(eq(blobMetadata.id, id)).all();
    expect(rows[0]?.archived).toBe(false);
    expect(rows[0]?.archivedAt).toBeNull();
  });

  it("round-trips archived: true with archivedAt timestamp", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    db.insert(blobMetadata)
      .values({
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
        archived: true,
        archivedAt: now,
      })
      .run();

    const rows = db.select().from(blobMetadata).where(eq(blobMetadata.id, id)).all();
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(now);
  });

  it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at, archived, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
        )
        .run(
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          100,
          1,
          "avatar",
          "a".repeat(64),
          now,
        ),
    ).toThrow(/CHECK|constraint/i);
  });

  it("rejects archived=false with archivedAt set via CHECK constraint", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    expect(() =>
      client
        .prepare(
          `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, uploaded_at, archived, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          100,
          1,
          "avatar",
          "a".repeat(64),
          now,
          now,
        ),
    ).toThrow(/CHECK|constraint/i);
  });

  it("updates archived from false to true", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    db.insert(blobMetadata)
      .values({
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      })
      .run();

    db.update(blobMetadata)
      .set({ archived: true, archivedAt: now })
      .where(eq(blobMetadata.id, id))
      .run();

    const rows = db.select().from(blobMetadata).where(eq(blobMetadata.id, id)).all();
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(now);
  });
});
