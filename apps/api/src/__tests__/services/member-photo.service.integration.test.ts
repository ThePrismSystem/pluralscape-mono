import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgMemberTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fromCompositeCursor } from "../../lib/pagination.js";
import {
  createMemberPhoto,
  listMemberPhotos,
  reorderMemberPhotos,
  restoreMemberPhoto,
} from "../../services/member-photo.service.js";
import {
  assertApiError,
  asDb,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { memberPhotos } = schema;

// ── Helper: seed N photos directly into DB for quota testing ──────────────────
async function seedPhotos(
  db: PgliteDatabase<typeof schema>,
  systemId: SystemId,
  memberId: MemberId,
  count: number,
): Promise<void> {
  const now = Date.now();
  const blob = testBlob();
  for (let i = 0; i < count; i++) {
    await db.insert(memberPhotos).values({
      id: `mp_seed-${crypto.randomUUID()}`,
      memberId,
      systemId,
      sortOrder: i,
      encryptedData: blob,
      createdAt: now,
      updatedAt: now,
    });
  }
}

describe("member-photo.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let memberId: MemberId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgMemberTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    memberId = (await pgInsertMember(db, systemId)) as MemberId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(memberPhotos);
  });

  // ── createMemberPhoto ─────────────────────────────────────────────

  describe("createMemberPhoto — invalid blob format", () => {
    it("throws VALIDATION_ERROR for structurally invalid blob bytes", async () => {
      // Short payload under size limit but not a valid EncryptedBlob —
      // deserializeEncryptedBlob throws InvalidInputError, mapping to VALIDATION_ERROR.
      const badBase64 = Buffer.from(new Uint8Array([0xff, 0xfe, 0x00])).toString("base64");
      await assertApiError(
        createMemberPhoto(
          asDb(db),
          systemId,
          memberId,
          { encryptedData: badBase64 },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("createMemberPhoto — per-member quota", () => {
    it("throws QUOTA_EXCEEDED after 5 photos on the same member", async () => {
      const enc = testEncryptedDataBase64();
      for (let i = 0; i < 5; i++) {
        await createMemberPhoto(
          asDb(db),
          systemId,
          memberId,
          { encryptedData: enc },
          auth,
          noopAudit,
        );
      }
      await assertApiError(
        createMemberPhoto(asDb(db), systemId, memberId, { encryptedData: enc }, auth, noopAudit),
        "QUOTA_EXCEEDED",
        409,
      );
    });
  });

  describe("createMemberPhoto — system-wide quota", () => {
    it("throws QUOTA_EXCEEDED when system has 500 active photos", async () => {
      // Seed 500 photos for this member directly (bypasses per-member quota check
      // because we're inserting via DB, not the service). We need 500 system photos
      // to trigger the system quota branch. Use a second member to avoid hitting the
      // per-member check first (the service checks per-member before system quota).
      const secondMemberId = (await pgInsertMember(db, systemId)) as MemberId;
      // Seed 100 members × 5 photos = 500 via direct insert across multiple members
      // to stay within per-member limit. Simplification: seed all 500 on secondMember
      // directly (bypassing the service) to trigger the system-wide path.
      await seedPhotos(db, systemId, secondMemberId, 500);

      const enc = testEncryptedDataBase64();
      // Now try to add a photo for our original member — per-member quota is 0,
      // but system quota (500) is already hit.
      await assertApiError(
        createMemberPhoto(asDb(db), systemId, memberId, { encryptedData: enc }, auth, noopAudit),
        "QUOTA_EXCEEDED",
        409,
      );
    });
  });

  describe("createMemberPhoto — auto sort order with existing photos", () => {
    it("auto-assigns sortOrder as max + 1 when photos already exist", async () => {
      const enc = testEncryptedDataBase64();

      const first = await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );
      expect(first.sortOrder).toBe(0);

      // Second photo without explicit sortOrder — covers maxSort-not-null branch
      const second = await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );
      expect(second.sortOrder).toBe(1);
    });
  });

  // ── listMemberPhotos — cursor branch ─────────────────────────────

  describe("listMemberPhotos — cursor pagination", () => {
    it("returns results after the cursor position", async () => {
      const enc = testEncryptedDataBase64();

      await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );
      await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );
      const third = await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );

      const page1 = await listMemberPhotos(asDb(db), systemId, memberId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

      // Decode cursor and fetch second page — covers cursor branch
      const decoded = fromCompositeCursor(page1.nextCursor ?? "", "photo");
      const page2 = await listMemberPhotos(asDb(db), systemId, memberId, auth, {
        limit: 2,
        cursor: decoded,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0]?.id).toBe(third.id);
      expect(page2.hasMore).toBe(false);
    });
  });

  // ── reorderMemberPhotos — count mismatch ─────────────────────────

  describe("reorderMemberPhotos — count mismatch", () => {
    it("throws VALIDATION_ERROR when reorder omits an active photo", async () => {
      const enc = testEncryptedDataBase64();

      const p1 = await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );
      await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );

      await assertApiError(
        reorderMemberPhotos(
          asDb(db),
          systemId,
          memberId,
          { order: [{ id: p1.id, sortOrder: 0 }] },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── restoreMemberPhoto — NOT_FOUND ────────────────────────────────

  describe("restoreMemberPhoto — not found", () => {
    it("throws NOT_FOUND when photo is active (not archived)", async () => {
      const enc = testEncryptedDataBase64();
      const photo = await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );

      // Covers existing=null branch: query filters archived=true, active won't match
      await assertApiError(
        restoreMemberPhoto(asDb(db), systemId, memberId, photo.id, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND when photo id does not exist at all", async () => {
      const nonExistent = `mp_${crypto.randomUUID()}` as MemberPhotoId;
      await assertApiError(
        restoreMemberPhoto(asDb(db), systemId, memberId, nonExistent, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── restoreMemberPhoto — quota on restore ─────────────────────────

  describe("restoreMemberPhoto — quota on restore", () => {
    it("throws QUOTA_EXCEEDED (member quota) when restoring into a full member slot", async () => {
      const enc = testEncryptedDataBase64();

      const photoIds: MemberPhotoId[] = [];
      for (let i = 0; i < 5; i++) {
        const p = await createMemberPhoto(
          asDb(db),
          systemId,
          memberId,
          { encryptedData: enc },
          auth,
          noopAudit,
        );
        photoIds.push(p.id);
      }

      const toArchive = photoIds[0];
      if (!toArchive) throw new Error("Expected photo id");
      await db
        .update(memberPhotos)
        .set({ archived: true, archivedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(memberPhotos.id, toArchive));

      // Fill back to 5 active
      await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );

      // Restore should fail with QUOTA_EXCEEDED (5 active already)
      await assertApiError(
        restoreMemberPhoto(asDb(db), systemId, memberId, toArchive, auth, noopAudit),
        "QUOTA_EXCEEDED",
        409,
      );
    });

    it("throws QUOTA_EXCEEDED (system quota) when restoring into a full system", async () => {
      const enc = testEncryptedDataBase64();

      // Archive one photo of our member first
      const photoToRestore = await createMemberPhoto(
        asDb(db),
        systemId,
        memberId,
        { encryptedData: enc },
        auth,
        noopAudit,
      );
      await db
        .update(memberPhotos)
        .set({ archived: true, archivedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(memberPhotos.id, photoToRestore.id));

      // Seed 500 active photos on a second member to hit system quota
      const extraMemberId = (await pgInsertMember(db, systemId)) as MemberId;
      await seedPhotos(db, systemId, extraMemberId, 500);

      // Restore should fail with system QUOTA_EXCEEDED
      await assertApiError(
        restoreMemberPhoto(asDb(db), systemId, memberId, photoToRestore.id, auth, noopAudit),
        "QUOTA_EXCEEDED",
        409,
      );
    });
  });
});
