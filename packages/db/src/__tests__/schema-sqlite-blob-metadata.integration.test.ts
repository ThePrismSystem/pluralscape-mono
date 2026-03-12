import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { blobMetadata } from "../schema/sqlite/blob-metadata.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteBlobMetadataTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, buckets, blobMetadata };

describe("SQLite blob_metadata schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteBlobMetadataTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("round-trips all fields", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(blobMetadata)
      .values({
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        mimeType: "image/png",
        sizeBytes: 1024,
        encryptionTier: 1,
        purpose: "avatar",
        checksum: "sha256-abc",
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
    const now = Date.now();

    db.insert(blobMetadata)
      .values({
        id: crypto.randomUUID(),
        systemId,
        storageKey,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "attachment",
        checksum: "sha256:test",
        uploadedAt: now,
      })
      .run();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: crypto.randomUUID(),
          systemId,
          storageKey,
          sizeBytes: 200,
          encryptionTier: 1,
          purpose: "attachment",
          checksum: "sha256:test",
          uploadedAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("cascades on system deletion", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(blobMetadata)
      .values({
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 2,
        purpose: "member-photo",
        checksum: "sha256:test",
        uploadedAt: now,
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db.select().from(blobMetadata).where(eq(blobMetadata.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("sets bucket_id to NULL on bucket deletion", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const bucketId = crypto.randomUUID();
    const id = crypto.randomUUID();
    const now = Date.now();

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
        id,
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "attachment",
        checksum: "sha256:test",
        bucketId,
        uploadedAt: now,
      })
      .run();

    db.delete(buckets).where(eq(buckets.id, bucketId)).run();
    const rows = db.select().from(blobMetadata).where(eq(blobMetadata.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.bucketId).toBeNull();
  });

  it("rejects invalid purpose", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = Date.now();

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
          "sha256:test",
          now,
        ),
    ).toThrow();
  });

  it("rejects sizeBytes <= 0", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: crypto.randomUUID(),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: 0,
          encryptionTier: 1,
          purpose: "avatar",
          checksum: "sha256:test",
          uploadedAt: now,
        })
        .run(),
    ).toThrow();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: crypto.randomUUID(),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: -1,
          encryptionTier: 1,
          purpose: "avatar",
          checksum: "sha256:test",
          uploadedAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("rejects invalid encryptionTier", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: crypto.randomUUID(),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: 100,
          encryptionTier: 0,
          purpose: "avatar",
          checksum: "sha256:test",
          uploadedAt: now,
        })
        .run(),
    ).toThrow();

    expect(() =>
      db
        .insert(blobMetadata)
        .values({
          id: crypto.randomUUID(),
          systemId,
          storageKey: `blobs/${crypto.randomUUID()}`,
          sizeBytes: 100,
          encryptionTier: 3,
          purpose: "avatar",
          checksum: "sha256:test",
          uploadedAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("rejects null checksum", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

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
});
