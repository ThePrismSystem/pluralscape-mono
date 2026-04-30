import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMember, duplicateMember } from "../../../services/member/create.js";
import { listAllMemberMemberships } from "../../../services/member/queries.js";
import {
  assertApiError,
  asDb,
  genGroupId,
  genMemberId,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../../helpers/integration-setup.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  AccountId,
  FieldDefinitionId,
  FieldValueId,
  MemberPhotoId,
  SystemId,
  SystemStructureEntityMemberLinkId,
} from "@pluralscape/types";
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

describe("member.service — duplicateMember / listAllMemberMemberships (PGlite integration)", () => {
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

  describe("duplicateMember", () => {
    it("duplicates a member without copying extras", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        {
          encryptedData: testEncryptedDataBase64(),
          copyPhotos: false,
          copyFields: false,
          copyMemberships: false,
        },
        auth,
        noopAudit,
      );

      expect(dup.id).not.toBe(source.id);
      expect(dup.id).toMatch(/^mem_/);
      expect(dup.systemId).toBe(systemId);
      expect(dup.archived).toBe(false);
    });

    it("throws NOT_FOUND when source member does not exist", async () => {
      await assertApiError(
        duplicateMember(
          asDb(db),
          systemId,
          genMemberId(),
          {
            encryptedData: testEncryptedDataBase64(),
            copyPhotos: false,
            copyFields: false,
            copyMemberships: false,
          },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("copies photos when copyPhotos is true and source has photos", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(memberPhotos).values({
        id: brandId<MemberPhotoId>(`mph_${crypto.randomUUID()}`),
        memberId: source.id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        {
          encryptedData: testEncryptedDataBase64(),
          copyPhotos: true,
          copyFields: false,
          copyMemberships: false,
        },
        auth,
        noopAudit,
      );

      const copiedPhotos = await db
        .select()
        .from(memberPhotos)
        .where(and(eq(memberPhotos.memberId, dup.id), eq(memberPhotos.systemId, systemId)));
      expect(copiedPhotos).toHaveLength(1);
    });

    it("duplicates without copying photos when source has no photos", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        {
          encryptedData: testEncryptedDataBase64(),
          copyPhotos: true,
          copyFields: false,
          copyMemberships: false,
        },
        auth,
        noopAudit,
      );

      const copiedPhotos = await db
        .select()
        .from(memberPhotos)
        .where(and(eq(memberPhotos.memberId, dup.id), eq(memberPhotos.systemId, systemId)));
      expect(copiedPhotos).toHaveLength(0);
    });

    it("copies field values when copyFields is true and source has values", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      const fdId = brandId<FieldDefinitionId>(`fd_${crypto.randomUUID()}`);
      await db.insert(fieldDefinitions).values({
        id: fdId,
        systemId,
        fieldType: "text",
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(`fv_${crypto.randomUUID()}`),
        fieldDefinitionId: fdId,
        memberId: source.id,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        {
          encryptedData: testEncryptedDataBase64(),
          copyPhotos: false,
          copyFields: true,
          copyMemberships: false,
        },
        auth,
        noopAudit,
      );

      const copiedValues = await db
        .select()
        .from(fieldValues)
        .where(and(eq(fieldValues.memberId, dup.id), eq(fieldValues.systemId, systemId)));
      expect(copiedValues).toHaveLength(1);
    });

    it("duplicates without copying field values when source has none", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        {
          encryptedData: testEncryptedDataBase64(),
          copyPhotos: false,
          copyFields: true,
          copyMemberships: false,
        },
        auth,
        noopAudit,
      );

      const copiedValues = await db
        .select()
        .from(fieldValues)
        .where(and(eq(fieldValues.memberId, dup.id), eq(fieldValues.systemId, systemId)));
      expect(copiedValues).toHaveLength(0);
    });

    it("copies group memberships when copyMemberships is true and source has memberships", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
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
      await db
        .insert(groupMemberships)
        .values({ groupId, memberId: source.id, systemId, createdAt: now });

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        {
          encryptedData: testEncryptedDataBase64(),
          copyPhotos: false,
          copyFields: false,
          copyMemberships: true,
        },
        auth,
        noopAudit,
      );

      const copiedMemberships = await db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.memberId, dup.id), eq(groupMemberships.systemId, systemId)));
      expect(copiedMemberships).toHaveLength(1);
      expect(copiedMemberships[0]?.groupId).toBe(groupId);
    });

    it("duplicates without copying memberships when source has none", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        {
          encryptedData: testEncryptedDataBase64(),
          copyPhotos: false,
          copyFields: false,
          copyMemberships: true,
        },
        auth,
        noopAudit,
      );

      const copiedMemberships = await db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.memberId, dup.id), eq(groupMemberships.systemId, systemId)));
      expect(copiedMemberships).toHaveLength(0);
    });
  });

  describe("listAllMemberMemberships", () => {
    it("returns empty groups and structureEntities when member has no memberships", async () => {
      const member = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await listAllMemberMemberships(asDb(db), systemId, member.id, auth);

      expect(result.groups).toHaveLength(0);
      expect(result.structureEntities).toHaveLength(0);
    });

    it("returns group memberships when member belongs to a group", async () => {
      const member = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
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
      await db
        .insert(groupMemberships)
        .values({ groupId, memberId: member.id, systemId, createdAt: now });

      const result = await listAllMemberMemberships(asDb(db), systemId, member.id, auth);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0]?.groupId).toBe(groupId);
    });

    it("returns structure entity links when present", async () => {
      const member = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      const linkId = brandId<SystemStructureEntityMemberLinkId>(`ssml_${crypto.randomUUID()}`);
      await db.insert(systemStructureEntityMemberLinks).values({
        id: linkId,
        systemId,
        memberId: member.id,
        sortOrder: 0,
        createdAt: now,
      });

      const result = await listAllMemberMemberships(asDb(db), systemId, member.id, auth);

      expect(result.structureEntities).toHaveLength(1);
      expect(result.structureEntities[0]?.id).toBe(linkId);
    });

    it("throws NOT_FOUND when member does not exist", async () => {
      await assertApiError(
        listAllMemberMemberships(asDb(db), systemId, genMemberId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });
});
