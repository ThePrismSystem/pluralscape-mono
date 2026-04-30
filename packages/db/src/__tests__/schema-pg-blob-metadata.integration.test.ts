import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { blobMetadata } from "../schema/pg/blob-metadata.js";
import { buckets } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createPgBlobMetadataTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type {
  BlobId,
  BucketId,
  ChecksumHex,
  EncryptionTier,
  ServerInternal,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, buckets, blobMetadata };

/**
 * The `blob_metadata` schema brands a handful of server-only columns with
 * `ServerInternal<T>` so `Serialize<>` strips them at the wire boundary.
 * Test fixtures don't care about that brand — these helpers tag the raw
 * inputs at the boundary so the typed `.values({…})` overload accepts them
 * without polluting every assertion site with a brand cast.
 */
function asInternalKey(value: string): ServerInternal<string> {
  return value as ServerInternal<string>;
}
function asInternalTier(value: EncryptionTier): ServerInternal<EncryptionTier> {
  return value as ServerInternal<EncryptionTier>;
}
function asInternalBucket(value: BucketId): ServerInternal<BucketId> {
  return value as ServerInternal<BucketId>;
}

describe("PG blob_metadata schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgBlobMetadataTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(blobMetadata);
  });

  it("round-trips all fields", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
      mimeType: "image/png",
      sizeBytes: 1024,
      encryptionTier: asInternalTier(1),
      purpose: "avatar",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      createdAt: now,
      uploadedAt: now,
    });

    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.mimeType).toBe("image/png");
    expect(rows[0]?.sizeBytes).toBe(1024);
    expect(rows[0]?.encryptionTier).toBe(1);
    expect(rows[0]?.purpose).toBe("avatar");
    expect(rows[0]?.thumbnailOfBlobId).toBeNull();
    expect(rows[0]?.bucketId).toBeNull();
  });

  it("enforces unique storage_key", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const storageKey = asInternalKey(`blobs/${crypto.randomUUID()}`);
    const now = fixtureNow();

    await db.insert(blobMetadata).values({
      id: brandId<BlobId>(crypto.randomUUID()),
      systemId,
      storageKey,
      sizeBytes: 100,
      encryptionTier: asInternalTier(1),
      purpose: "attachment",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      createdAt: now,
      uploadedAt: now,
    });

    await expect(
      db.insert(blobMetadata).values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey,
        sizeBytes: 200,
        encryptionTier: asInternalTier(1),
        purpose: "attachment",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects size_bytes <= 0", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    await expect(
      db.insert(blobMetadata).values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
        sizeBytes: 0,
        encryptionTier: asInternalTier(1),
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid encryption_tier", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    // Intentionally testing CHECK constraint with invalid tier value;
    // 3 is not a valid EncryptionTier (1 | 2). The @ts-expect-error
    // directive is load-bearing: if TS ever accepts `3` here, the test
    // would silently turn into a no-op (the runtime CHECK could never
    // fire if TS pre-validates the value).
    await expect(
      // @ts-expect-error invalid encryptionTier value: testing runtime CHECK
      db.insert(blobMetadata).values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
        sizeBytes: 100,
        encryptionTier: 3,
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid purpose", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    await expect(
      db.insert(blobMetadata).values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
        sizeBytes: 100,
        encryptionTier: asInternalTier(1),
        purpose: "invalid" as "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("cascades on system deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
      sizeBytes: 100,
      encryptionTier: asInternalTier(2),
      purpose: "member-photo",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      createdAt: now,
      uploadedAt: now,
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows).toHaveLength(0);
  });

  it("restricts bucket deletion when referenced by blob metadata", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const bucketId = brandId<BucketId>(crypto.randomUUID());
    const now = fixtureNow();

    await db.insert(buckets).values({
      id: bucketId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blobMetadata).values({
      id: brandId<BlobId>(crypto.randomUUID()),
      systemId,
      storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
      sizeBytes: 100,
      encryptionTier: asInternalTier(1),
      purpose: "attachment",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      bucketId: asInternalBucket(bucketId),
      createdAt: now,
      uploadedAt: now,
    });

    await expect(db.delete(buckets).where(eq(buckets.id, bucketId))).rejects.toThrow();
  });

  it("allows null checksum when uploadedAt is also null (pending upload)", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = new Date().toISOString();

    // NULL checksum + NULL uploadedAt = valid pending upload
    await client.query(
      `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, created_at, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, NULL)`,
      [id, systemId, `blobs/${crypto.randomUUID()}`, 100, 1, "avatar", now],
    );

    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.checksum).toBeNull();
    expect(rows[0]?.uploadedAt).toBeNull();
  });

  it("rejects null checksum with non-null uploadedAt (pending consistency)", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = new Date().toISOString();

    await expect(
      client.query(
        `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, created_at, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8)`,
        [crypto.randomUUID(), systemId, `blobs/${crypto.randomUUID()}`, 100, 1, "avatar", now, now],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("rejects checksum not exactly 64 characters", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    await expect(
      db.insert(blobMetadata).values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
        sizeBytes: 100,
        encryptionTier: asInternalTier(1),
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(63)),
        createdAt: now,
        uploadedAt: now,
      }),
    ).rejects.toThrow(/check|constraint/i);

    await expect(
      db.insert(blobMetadata).values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
        sizeBytes: 100,
        encryptionTier: asInternalTier(1),
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(65)),
        createdAt: now,
        uploadedAt: now,
      }),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("accepts size_bytes at exactly 10 GB", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    await db.insert(blobMetadata).values({
      id: brandId<BlobId>(crypto.randomUUID()),
      systemId,
      storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
      sizeBytes: 10737418240,
      encryptionTier: asInternalTier(1),
      purpose: "avatar",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      createdAt: now,
      uploadedAt: now,
    });
  });

  it("rejects size_bytes exceeding 10 GB", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    await expect(
      db.insert(blobMetadata).values({
        id: brandId<BlobId>(crypto.randomUUID()),
        systemId,
        storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
        sizeBytes: 10737418241,
        encryptionTier: asInternalTier(1),
        purpose: "avatar",
        checksum: brandId<ChecksumHex>("a".repeat(64)),
        createdAt: now,
        uploadedAt: now,
      }),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("defaults archived to false and archivedAt to null", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
      sizeBytes: 100,
      encryptionTier: asInternalTier(1),
      purpose: "avatar",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      createdAt: now,
      uploadedAt: now,
    });

    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows[0]?.archived).toBe(false);
    expect(rows[0]?.archivedAt).toBeNull();
  });

  it("round-trips archived: true with archivedAt timestamp", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
      sizeBytes: 100,
      encryptionTier: asInternalTier(1),
      purpose: "avatar",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      createdAt: now,
      uploadedAt: now,
      archived: true,
      archivedAt: now,
    });

    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(now);
  });

  it("updates archived from false to true", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = brandId<BlobId>(crypto.randomUUID());
    const now = fixtureNow();

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: asInternalKey(`blobs/${crypto.randomUUID()}`),
      sizeBytes: 100,
      encryptionTier: asInternalTier(1),
      purpose: "avatar",
      checksum: brandId<ChecksumHex>("a".repeat(64)),
      createdAt: now,
      uploadedAt: now,
    });

    const archiveTime = fixtureNow();
    await db
      .update(blobMetadata)
      .set({ archived: true, archivedAt: archiveTime })
      .where(eq(blobMetadata.id, id));

    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(archiveTime);
  });

  it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    await expect(
      client.query(
        `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, created_at, uploaded_at, archived, archived_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NULL)`,
        [
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          100,
          1,
          "avatar",
          "a".repeat(64),
          now,
          now,
        ],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = fixtureNow();

    await expect(
      client.query(
        `INSERT INTO blob_metadata (id, system_id, storage_key, size_bytes, encryption_tier, purpose, checksum, created_at, uploaded_at, archived, archived_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)`,
        [
          crypto.randomUUID(),
          systemId,
          `blobs/${crypto.randomUUID()}`,
          100,
          1,
          "avatar",
          "a".repeat(64),
          now,
          now,
          now,
        ],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });
});
