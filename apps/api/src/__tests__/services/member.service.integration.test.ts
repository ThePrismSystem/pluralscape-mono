import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMember, duplicateMember } from "../../services/member/create.js";
import { archiveMember, deleteMember, restoreMember } from "../../services/member/lifecycle.js";
import { getMember, listAllMemberMemberships, listMembers } from "../../services/member/queries.js";
import { updateMember } from "../../services/member/update.js";
import {
  assertApiError,
  asDb,
  genGroupId,
  genMemberId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, FrontingSessionId, SystemId } from "@pluralscape/types";
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

describe("member.service (PGlite integration)", () => {
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

    it("throws VALIDATION_ERROR for invalid create payload", async () => {
      await assertApiError(
        createMember(asDb(db), systemId, { encryptedData: 123 }, auth, noopAudit),
        "VALIDATION_ERROR",
        400,
      );
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
      await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const page1 = await listMembers(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(typeof page1.nextCursor).toBe("string");

      // listMembers accepts a raw ID as cursor (route layer decodes the opaque cursor)
      const lastItemId = page1.data[page1.data.length - 1]?.id;
      expect(typeof lastItemId).toBe("string");

      const page2 = await listMembers(asDb(db), systemId, auth, {
        cursor: lastItemId,
        limit: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it("includes archived members when includeArchived is true", async () => {
      const active = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      const archived = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await archiveMember(asDb(db), systemId, archived.id, auth, noopAudit);

      const withArchived = await listMembers(asDb(db), systemId, auth, { includeArchived: true });
      const withoutArchived = await listMembers(asDb(db), systemId, auth);

      expect(withArchived.data).toHaveLength(2);
      expect(withoutArchived.data).toHaveLength(1);
      expect(withoutArchived.data[0]?.id).toBe(active.id);
    });

    it("filters by groupId", async () => {
      const m1 = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const groupId = genGroupId();
      const now = Date.now();
      await db.insert(groups).values({
        id: groupId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(groupMemberships).values({
        groupId,
        memberId: m1.id,
        systemId,
        createdAt: now,
      });

      const result = await listMembers(asDb(db), systemId, auth, { groupId });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(m1.id);
    });
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

    it("throws VALIDATION_ERROR for invalid update payload", async () => {
      const created = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await assertApiError(
        updateMember(asDb(db), systemId, created.id, { encryptedData: 123 }, auth, noopAudit),
        "VALIDATION_ERROR",
        400,
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
      const now = Date.now();
      await db.insert(memberPhotos).values({
        id: `mph_${crypto.randomUUID()}`,
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
      const now = Date.now();
      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`),
        systemId,
        memberId: created.id,
        startTime: now - 3_600_000,
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
      const now = Date.now();
      await db.insert(relationships).values({
        id: `rel_${crypto.randomUUID()}`,
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
      const now = Date.now();
      await db.insert(notes).values({
        id: `note_${crypto.randomUUID()}`,
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
      const now = Date.now();
      await db.insert(acknowledgements).values({
        id: `ack_${crypto.randomUUID()}`,
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
      const now = Date.now();
      await db.insert(polls).values({
        id: `poll_${crypto.randomUUID()}`,
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
      const now = Date.now();
      const timerId = `tmr_${crypto.randomUUID()}`;
      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(checkInRecords).values({
        id: `cir_${crypto.randomUUID()}`,
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
      const now = Date.now();
      await db.insert(groups).values({
        id: groupId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(groupMemberships).values({
        groupId,
        memberId: created.id,
        systemId,
        createdAt: now,
      });

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
      const now = Date.now();
      const fdId = `fd_${crypto.randomUUID()}`;
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
        id: `fv_${crypto.randomUUID()}`,
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
      const now = Date.now();
      await db.insert(systemStructureEntityMemberLinks).values({
        id: `ssml_${crypto.randomUUID()}`,
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
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      expect(dup.id).not.toBe(source.id);
      expect(dup.id).toMatch(/^mem_/);
      expect(dup.systemId).toBe(systemId);
      expect(dup.archived).toBe(false);
    });

    it("throws VALIDATION_ERROR for invalid duplicate payload", async () => {
      const source = await createMember(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await assertApiError(
        duplicateMember(asDb(db), systemId, source.id, { encryptedData: 999 }, auth, noopAudit),
        "VALIDATION_ERROR",
        400,
      );
    });

    it("throws NOT_FOUND when source member does not exist", async () => {
      await assertApiError(
        duplicateMember(
          asDb(db),
          systemId,
          genMemberId(),
          { encryptedData: testEncryptedDataBase64() },
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
      const now = Date.now();
      await db.insert(memberPhotos).values({
        id: `mph_${crypto.randomUUID()}`,
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
        { encryptedData: testEncryptedDataBase64(), copyPhotos: true },
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
        { encryptedData: testEncryptedDataBase64(), copyPhotos: true },
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
      const now = Date.now();
      const fdId = `fd_${crypto.randomUUID()}`;
      await db.insert(fieldDefinitions).values({
        id: fdId,
        systemId,
        fieldType: "text",
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(fieldValues).values({
        id: `fv_${crypto.randomUUID()}`,
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
        { encryptedData: testEncryptedDataBase64(), copyFields: true },
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
        { encryptedData: testEncryptedDataBase64(), copyFields: true },
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
      const now = Date.now();
      await db.insert(groups).values({
        id: groupId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(groupMemberships).values({
        groupId,
        memberId: source.id,
        systemId,
        createdAt: now,
      });

      const dup = await duplicateMember(
        asDb(db),
        systemId,
        source.id,
        { encryptedData: testEncryptedDataBase64(), copyMemberships: true },
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
        { encryptedData: testEncryptedDataBase64(), copyMemberships: true },
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
      const now = Date.now();
      await db.insert(groups).values({
        id: groupId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(groupMemberships).values({
        groupId,
        memberId: member.id,
        systemId,
        createdAt: now,
      });

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
      const now = Date.now();
      const linkId = `ssml_${crypto.randomUUID()}`;
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
