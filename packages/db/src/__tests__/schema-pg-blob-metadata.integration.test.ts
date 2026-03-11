import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { blobMetadata } from "../schema/pg/blob-metadata.js";
import { buckets } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgBlobMetadataTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, buckets, blobMetadata };

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

  it("round-trips all fields", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: `blobs/${crypto.randomUUID()}`,
      mimeType: "image/png",
      sizeBytes: 1024,
      encryptionTier: 1,
      purpose: "avatar",
      checksum: "sha256-abc",
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
    const storageKey = `blobs/${crypto.randomUUID()}`;
    const now = Date.now();

    await db.insert(blobMetadata).values({
      id: crypto.randomUUID(),
      systemId,
      storageKey,
      sizeBytes: 100,
      encryptionTier: 1,
      purpose: "attachment",
      uploadedAt: now,
    });

    await expect(
      db.insert(blobMetadata).values({
        id: crypto.randomUUID(),
        systemId,
        storageKey,
        sizeBytes: 200,
        encryptionTier: 1,
        purpose: "attachment",
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects size_bytes <= 0", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = Date.now();

    await expect(
      db.insert(blobMetadata).values({
        id: crypto.randomUUID(),
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 0,
        encryptionTier: 1,
        purpose: "avatar",
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid encryption_tier", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = Date.now();

    await expect(
      db.insert(blobMetadata).values({
        id: crypto.randomUUID(),
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 3,
        purpose: "avatar",
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid purpose", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = Date.now();

    await expect(
      db.insert(blobMetadata).values({
        id: crypto.randomUUID(),
        systemId,
        storageKey: `blobs/${crypto.randomUUID()}`,
        sizeBytes: 100,
        encryptionTier: 1,
        purpose: "invalid" as "avatar",
        uploadedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("cascades on system deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: `blobs/${crypto.randomUUID()}`,
      sizeBytes: 100,
      encryptionTier: 2,
      purpose: "member-photo",
      uploadedAt: now,
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows).toHaveLength(0);
  });

  it("sets bucket_id to NULL on bucket deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const bucketId = crypto.randomUUID();
    const id = crypto.randomUUID();
    const now = Date.now();

    await db.insert(buckets).values({
      id: bucketId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blobMetadata).values({
      id,
      systemId,
      storageKey: `blobs/${crypto.randomUUID()}`,
      sizeBytes: 100,
      encryptionTier: 1,
      purpose: "attachment",
      bucketId,
      uploadedAt: now,
    });

    await db.delete(buckets).where(eq(buckets.id, bucketId));
    const rows = await db.select().from(blobMetadata).where(eq(blobMetadata.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.bucketId).toBeNull();
  });
});
