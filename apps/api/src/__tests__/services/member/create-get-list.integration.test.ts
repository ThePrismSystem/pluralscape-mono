import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMember } from "../../../services/member/create.js";
import { archiveMember } from "../../../services/member/lifecycle.js";
import { getMember, listMembers } from "../../../services/member/queries.js";
import {
  assertApiError,
  asDb,
  genGroupId,
  genMemberId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../../helpers/integration-setup.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { acknowledgements, checkInRecords, fieldDefinitions, fieldValues, frontingComments, frontingSessions, groupMemberships, groups, memberPhotos, members, notes, polls, relationships, systemStructureEntityMemberLinks, timerConfigs } = schema;

describe("member.service — create / getMember / listMembers (PGlite integration)", () => {
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

  describe("createMember", () => {
    it("creates a member with correct id prefix and version", async () => {
      const result = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      expect(result.id).toMatch(/^mem_/);
      expect(result.version).toBe(1);
      expect(result.systemId).toBe(systemId);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
    });

    it("writes an audit entry on create", async () => {
      const audit = spyAudit();
      await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        audit,
      );

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("member.created");
      expect(audit.calls[0]?.actor).toEqual({ kind: "account", id: auth.accountId });
    });

    it("throws NOT_FOUND for unknown system (assertSystemOwnership)", async () => {
      const otherAccountId = brandId<AccountId>(await pgInsertAccount(db));
      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, otherAccountId));
      const wrongAuth = makeAuth(accountId, systemId); // auth for systemId, not otherSystemId
      await assertApiError(
        createMember(
          asDb(db),
          otherSystemId,
          { encryptedData: testEncryptedDataBase64() },
          wrongAuth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("getMember", () => {
    it("returns a previously created member", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await getMember(asDb(db), systemId, created.id, auth);

      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
      expect(result.version).toBe(created.version);
      expect(result.encryptedData).toBe(created.encryptedData);
    });

    it("throws NOT_FOUND for a non-existent member", async () => {
      await assertApiError(getMember(asDb(db), systemId, genMemberId(), auth), "NOT_FOUND", 404);
    });

    it("throws NOT_FOUND when queried with a different system's auth", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const otherAccountId = brandId<AccountId>(await pgInsertAccount(db));
      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, otherAccountId));
      const otherAuth = makeAuth(otherAccountId, otherSystemId);

      await assertApiError(
        getMember(asDb(db), otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("listMembers", () => {
    it("paginates with limit and cursor", async () => {
      await createMember(asDb(db), systemId, { encryptedData: testEncryptedDataBase64() }, auth, noopAudit);
      await createMember(asDb(db), systemId, { encryptedData: testEncryptedDataBase64() }, auth, noopAudit);
      await createMember(asDb(db), systemId, { encryptedData: testEncryptedDataBase64() }, auth, noopAudit);

      const page1 = await listMembers(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(typeof page1.nextCursor).toBe("string");

      // listMembers accepts a raw ID as cursor (route layer decodes the opaque cursor)
      const lastItemId = page1.data[page1.data.length - 1]?.id;
      expect(typeof lastItemId).toBe("string");

      const page2 = await listMembers(asDb(db), systemId, auth, { cursor: lastItemId, limit: 2 });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it("includes archived members when includeArchived is true", async () => {
      const active = await createMember(asDb(db), systemId, { encryptedData: testEncryptedDataBase64() }, auth, noopAudit);
      const archived = await createMember(asDb(db), systemId, { encryptedData: testEncryptedDataBase64() }, auth, noopAudit);
      await archiveMember(asDb(db), systemId, archived.id, auth, noopAudit);

      const withArchived = await listMembers(asDb(db), systemId, auth, { includeArchived: true });
      const withoutArchived = await listMembers(asDb(db), systemId, auth);

      expect(withArchived.data).toHaveLength(2);
      expect(withoutArchived.data).toHaveLength(1);
      expect(withoutArchived.data[0]?.id).toBe(active.id);
    });

    it("filters by groupId", async () => {
      const m1 = await createMember(asDb(db), systemId, { encryptedData: testEncryptedDataBase64() }, auth, noopAudit);
      await createMember(asDb(db), systemId, { encryptedData: testEncryptedDataBase64() }, auth, noopAudit);

      const groupId = genGroupId();
      const now = toUnixMillis(Date.now());
      await db.insert(groups).values({
        id: groupId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(groupMemberships).values({ groupId, memberId: m1.id, systemId, createdAt: now });

      const result = await listMembers(asDb(db), systemId, auth, { groupId });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(m1.id);
    });
  });
});
