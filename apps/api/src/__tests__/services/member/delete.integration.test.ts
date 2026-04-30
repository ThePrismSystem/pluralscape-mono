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
import { deleteMember } from "../../../services/member/lifecycle.js";
import { getMember } from "../../../services/member/queries.js";
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
  AcknowledgementId,
  CheckInRecordId,
  FieldDefinitionId,
  FieldValueId,
  FrontingSessionId,
  MemberPhotoId,
  NoteId,
  PollId,
  RelationshipId,
  SystemId,
  SystemStructureEntityMemberLinkId,
  TimerId,
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

describe("member.service — deleteMember (PGlite integration)", () => {
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

  describe("deleteMember", () => {
    it("removes the member so getMember returns NOT_FOUND", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await deleteMember(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(getMember(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });

    it("throws NOT_FOUND when deleting a non-existent member", async () => {
      await assertApiError(
        deleteMember(asDb(db), systemId, genMemberId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws HAS_DEPENDENTS when member has photos", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(memberPhotos).values({
        id: brandId<MemberPhotoId>(`mph_${crypto.randomUUID()}`),
        memberId: created.id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "photos")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has fronting sessions", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`),
        systemId,
        memberId: created.id,
        startTime: toUnixMillis(now - 3_600_000),
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "frontingSessions")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has a relationship", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(relationships).values({
        id: brandId<RelationshipId>(`rel_${crypto.randomUUID()}`),
        systemId,
        sourceMemberId: created.id,
        type: "sibling",
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "relationships")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has notes", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(notes).values({
        id: brandId<NoteId>(`note_${crypto.randomUUID()}`),
        systemId,
        authorEntityType: "member",
        authorEntityId: created.id,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "notes")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has acknowledgements", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(acknowledgements).values({
        id: brandId<AcknowledgementId>(`ack_${crypto.randomUUID()}`),
        systemId,
        createdByMemberId: created.id,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "acknowledgements")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has polls", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(polls).values({
        id: brandId<PollId>(`poll_${crypto.randomUUID()}`),
        systemId,
        createdByMemberId: created.id,
        kind: "standard",
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: false,
        allowVeto: false,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "polls")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has check-in records", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      const timerId = brandId<TimerId>(`tmr_${crypto.randomUUID()}`);
      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(checkInRecords).values({
        id: brandId<CheckInRecordId>(`cir_${crypto.randomUUID()}`),
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
        respondedByMemberId: created.id,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "checkInRecords")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has group memberships", async () => {
      const created = await createMember(
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
        .values({ groupId, memberId: created.id, systemId, createdAt: now });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "groupMemberships")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has field values", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      const fdId = brandId<FieldDefinitionId>(`fd_${crypto.randomUUID()}`);
      // Insert field definition first (FK constraint)
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
        memberId: created.id,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "fieldValues")).toBe(true);
    });

    it("throws HAS_DEPENDENTS when member has structure entity member links", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const now = toUnixMillis(Date.now());
      await db.insert(systemStructureEntityMemberLinks).values({
        id: brandId<SystemStructureEntityMemberLinkId>(`ssml_${crypto.randomUUID()}`),
        systemId,
        memberId: created.id,
        sortOrder: 0,
        createdAt: now,
      });

      const err = await assertApiError(
        deleteMember(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      const detail = err.details as { dependents: { type: string; count: number }[] };
      expect(detail.dependents.some((d) => d.type === "structureEntityMemberLinks")).toBe(true);
    });
  });
});
