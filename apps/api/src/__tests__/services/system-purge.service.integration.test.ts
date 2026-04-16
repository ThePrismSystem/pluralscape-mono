import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Mock auth key verification — real Argon2id/sodium requires worker threads
const mockVerifyAuthKey = vi.fn<() => boolean>().mockReturnValue(true);

vi.mock("@pluralscape/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/crypto")>();
  return {
    ...actual,
    fromHex: actual.fromHex,
    verifyAuthKey: (): boolean => mockVerifyAuthKey(),
  };
});

import { purgeSystem } from "../../services/system-purge.service.js";
import {
  asDb,
  makeAuth,
  noopAudit,
  spyAudit,
  assertApiError,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { systems, members, groups, groupMemberships, relationships, notes, channels, messages } =
  schema;

describe("system-purge.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAllTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  async function setupSystemWithDependents(): Promise<{
    accountId: AccountId;
    systemId: SystemId;
    auth: AuthContext;
  }> {
    const accountId = (await pgInsertAccount(db)) as AccountId;
    const systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    const auth = makeAuth(accountId, systemId);

    // Add members
    const memberA = await pgInsertMember(db, systemId);
    const memberB = await pgInsertMember(db, systemId);

    // Add a relationship
    const now = Date.now();
    await db.insert(relationships).values({
      id: `rel_${crypto.randomUUID()}`,
      systemId,
      sourceMemberId: memberA,
      targetMemberId: memberB,
      type: "sibling",
      bidirectional: true,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    // Add a group with membership
    const groupId = `grp_${crypto.randomUUID()}`;
    await db.insert(groups).values({
      id: groupId,
      systemId,
      parentGroupId: null,
      sortOrder: 0,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(groupMemberships).values({
      groupId,
      memberId: memberA,
      systemId,
      createdAt: now,
    });

    // Add a channel with a message
    const channelId = `ch_${crypto.randomUUID()}`;
    await db.insert(channels).values({
      id: channelId,
      systemId,
      type: "channel",
      parentId: null,
      sortOrder: 0,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(messages).values({
      id: `msg_${crypto.randomUUID()}`,
      channelId,
      systemId,
      timestamp: now,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    // Add a note
    await db.insert(notes).values({
      id: `note_${crypto.randomUUID()}`,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    // Archive the system (required precondition for purge)
    await db
      .update(systems)
      .set({ archived: true, archivedAt: now })
      .where(eq(systems.id, systemId));

    return { accountId, systemId, auth };
  }

  describe("purgeSystem", () => {
    it("deletes the system and all child entities via CASCADE", async () => {
      const { systemId, auth } = await setupSystemWithDependents();
      const audit = spyAudit();

      await purgeSystem(asDb(db), systemId, { authKey: "aa".repeat(32) }, auth, audit);

      // Verify system is gone
      const systemRows = await db
        .select({ id: systems.id })
        .from(systems)
        .where(eq(systems.id, systemId));
      expect(systemRows).toHaveLength(0);

      // Verify members are gone
      const memberRows = await db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.systemId, systemId));
      expect(memberRows).toHaveLength(0);

      // Verify relationships are gone
      const relRows = await db
        .select({ id: relationships.id })
        .from(relationships)
        .where(eq(relationships.systemId, systemId));
      expect(relRows).toHaveLength(0);

      // Verify groups are gone
      const groupRows = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.systemId, systemId));
      expect(groupRows).toHaveLength(0);

      // Verify notes are gone
      const noteRows = await db
        .select({ id: notes.id })
        .from(notes)
        .where(eq(notes.systemId, systemId));
      expect(noteRows).toHaveLength(0);

      // Verify audit event
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("system.purged");
    });

    it("does not affect other systems", async () => {
      const { auth, accountId, systemId } = await setupSystemWithDependents();
      const otherSystemId = (await pgInsertSystem(db, accountId)) as SystemId;
      const otherMemberId = await pgInsertMember(db, otherSystemId);

      // Purge the first system
      await purgeSystem(asDb(db), systemId, { authKey: "aa".repeat(32) }, auth, noopAudit);

      // Other system and its members are still present
      const otherSystemRows = await db
        .select({ id: systems.id })
        .from(systems)
        .where(eq(systems.id, otherSystemId));
      expect(otherSystemRows).toHaveLength(1);

      const otherMemberRows = await db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.id, otherMemberId));
      expect(otherMemberRows).toHaveLength(1);
    });

    it("rejects purge on non-archived system", async () => {
      const accountId = (await pgInsertAccount(db)) as AccountId;
      const systemId = (await pgInsertSystem(db, accountId)) as SystemId;
      const auth = makeAuth(accountId, systemId);

      await assertApiError(
        purgeSystem(asDb(db), systemId, { authKey: "aa".repeat(32) }, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
        "must be archived",
      );
    });

    it("rejects purge with incorrect auth key", async () => {
      const { systemId, auth } = await setupSystemWithDependents();
      mockVerifyAuthKey.mockReturnValueOnce(false);

      await assertApiError(
        purgeSystem(asDb(db), systemId, { authKey: "ff".repeat(32) }, auth, noopAudit),
        "VALIDATION_ERROR",
        400,
        "Incorrect password",
      );
    });

    it("rejects purge for nonexistent system", async () => {
      const accountId = (await pgInsertAccount(db)) as AccountId;
      const fakeSystemId = `sys_${crypto.randomUUID()}` as SystemId;
      const auth = makeAuth(accountId, fakeSystemId);

      await assertApiError(
        purgeSystem(asDb(db), fakeSystemId, { authKey: "aa".repeat(32) }, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });
});
