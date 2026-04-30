import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMember } from "../../../services/member/create.js";
import { archiveMember, restoreMember } from "../../../services/member/lifecycle.js";
import { getMember } from "../../../services/member/queries.js";
import { updateMember } from "../../../services/member/update.js";
import {
  assertApiError,
  asDb,
  genMemberId,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../../helpers/integration-setup.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const {
  acknowledgements,
  checkInRecords,
  fieldDefinitions,
  fieldValues,
  frontingComments,
  frontingSessions,
  groupMemberships,
  groups,
  memberPhotos,
  members,
  notes,
  polls,
  relationships,
  systemStructureEntityMemberLinks,
  timerConfigs,
} = schema;

describe("member.service — updateMember / archiveMember / restoreMember (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAllTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(systemStructureEntityMemberLinks);
    await db.delete(acknowledgements);
    await db.delete(checkInRecords);
    await db.delete(notes);
    await db.delete(frontingComments);
    await db.delete(frontingSessions);
    await db.delete(polls);
    await db.delete(relationships);
    await db.delete(groupMemberships);
    await db.delete(groups);
    await db.delete(memberPhotos);
    await db.delete(fieldValues);
    await db.delete(fieldDefinitions);
    await db.delete(members);
    await db.delete(timerConfigs);
  });

  describe("updateMember", () => {
    it("increments version on successful update", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const updated = await updateMember(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      expect(updated.version).toBe(2);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await updateMember(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateMember(
          asDb(db),
          systemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("throws NOT_FOUND when updating a non-existent member", async () => {
      await assertApiError(
        updateMember(
          asDb(db),
          systemId,
          genMemberId(),
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("archiveMember", () => {
    it("archives a member so getMember returns NOT_FOUND", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveMember(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(getMember(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });

    it("throws NOT_FOUND when archiving a non-existent member", async () => {
      await assertApiError(
        archiveMember(asDb(db), systemId, genMemberId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("restoreMember", () => {
    it("restores an archived member", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveMember(asDb(db), systemId, created.id, auth, noopAudit);
      const restored = await restoreMember(asDb(db), systemId, created.id, auth, noopAudit);

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.id).toBe(created.id);
    });

    it("throws NOT_FOUND when restoring a non-archived (active) member", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      // Member is active, not archived — restore should throw NOT_FOUND
      await assertApiError(
        restoreMember(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND when restoring a completely non-existent member", async () => {
      await assertApiError(
        restoreMember(asDb(db), systemId, genMemberId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });
});
