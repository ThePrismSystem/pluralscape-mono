import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { members } from "../schema/pg/members.js";
import {
  layers,
  layerMemberships,
  relationships,
  sideSystems,
  sideSystemLayerLinks,
  sideSystemMemberships,
  subsystems,
  subsystemLayerLinks,
  subsystemMemberships,
  subsystemSideSystemLinks,
} from "../schema/pg/structure.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgStructureTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  members,
  relationships,
  subsystems,
  sideSystems,
  layers,
  subsystemMemberships,
  sideSystemMemberships,
  layerMemberships,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
  sideSystemLayerLinks,
};

describe("PG structure schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => pgInsertMember(db, systemId, id);

  async function insertSubsystem(
    systemId: string,
    parentSubsystemId: string | null = null,
    id = crypto.randomUUID(),
  ): Promise<string> {
    const now = Date.now();
    await db.insert(subsystems).values({
      id,
      systemId,
      parentSubsystemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertSideSystem(systemId: string, id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
    await db.insert(sideSystems).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertLayer(
    systemId: string,
    sortOrder: number,
    id = crypto.randomUUID(),
  ): Promise<string> {
    const now = Date.now();
    await db.insert(layers).values({
      id,
      systemId,
      sortOrder,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgStructureTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  // ── Primary entities ──────────────────────────────────────────────

  describe("relationships", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sourceMemberId = await insertMember(systemId);
      const targetMemberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        sourceMemberId,
        targetMemberId,
        type: "sibling",
        bidirectional: true,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.sourceMemberId).toBe(sourceMemberId);
      expect(rows[0]?.targetMemberId).toBe(targetMemberId);
      expect(rows[0]?.type).toBe("sibling");
      expect(rows[0]?.bidirectional).toBe(true);
    });

    it("defaults T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.sourceMemberId).toBeNull();
      expect(rows[0]?.targetMemberId).toBeNull();
      expect(rows[0]?.type).toBe("sibling");
      expect(rows[0]?.bidirectional).toBe(false);
    });

    it("rejects invalid type via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId,
          type: "invalid" as "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });

    it("sets sourceMemberId to null on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        sourceMemberId: memberId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.sourceMemberId).toBeNull();
    });

    it("rejects nonexistent sourceMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId,
          sourceMemberId: "nonexistent",
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("sets targetMemberId to null on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        targetMemberId: memberId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.targetMemberId).toBeNull();
    });

    it("rejects nonexistent targetMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId,
          targetMemberId: "nonexistent",
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("subsystems", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));

      await db.insert(subsystems).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(subsystems).where(eq(subsystems.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("allows nullable parentSubsystemId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystems).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(subsystems).where(eq(subsystems.id, id));
      expect(rows[0]?.parentSubsystemId).toBeNull();
    });

    it("sets parentSubsystemId to null on parent delete", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const parentId = await insertSubsystem(systemId);
      const childId = await insertSubsystem(systemId, parentId);

      // verify child references parent
      let rows = await db.select().from(subsystems).where(eq(subsystems.id, childId));
      expect(rows[0]?.parentSubsystemId).toBe(parentId);

      // delete parent
      await db.delete(subsystems).where(eq(subsystems.id, parentId));

      // child still exists, parentSubsystemId is null
      rows = await db.select().from(subsystems).where(eq(subsystems.id, childId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.parentSubsystemId).toBeNull();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(subsystems).where(eq(subsystems.id, subsystemId));
      expect(rows).toHaveLength(0);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystems).values({
        id,
        systemId,
        architectureType: { kind: "known", type: "orbital" },
        hasCore: true,
        discoveryStatus: "fully-mapped",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(subsystems).where(eq(subsystems.id, id));
      expect(rows[0]?.architectureType).toEqual({ kind: "known", type: "orbital" });
      expect(rows[0]?.hasCore).toBe(true);
      expect(rows[0]?.discoveryStatus).toBe("fully-mapped");
    });

    it("defaults T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystems).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(subsystems).where(eq(subsystems.id, id));
      expect(rows[0]?.architectureType).toBeNull();
      expect(rows[0]?.hasCore).toBe(false);
      expect(rows[0]?.discoveryStatus).toBeNull();
    });

    it("rejects invalid discoveryStatus via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(subsystems).values({
          id: crypto.randomUUID(),
          systemId,
          discoveryStatus: "invalid" as "fully-mapped",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });
  });

  describe("side_systems", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([5, 10, 15]));

      await db.insert(sideSystems).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(sideSystems).where(eq(sideSystems.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(sideSystems).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(sideSystems).where(eq(sideSystems.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(sideSystems).where(eq(sideSystems.id, sideSystemId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(sideSystems).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("layers", () => {
    it("inserts with sortOrder and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([7, 14, 21]));

      await db.insert(layers).values({
        id,
        systemId,
        sortOrder: 3,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(layers).where(eq(layers.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sortOrder).toBe(3);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(layers).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(layers).where(eq(layers.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const layerId = await insertLayer(systemId, 1);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(layers).where(eq(layers.id, layerId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(layers).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  // ── Memberships ───────────────────────────────────────────────────

  describe("subsystem_memberships", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([11, 22, 33]));

      await db.insert(subsystemMemberships).values({
        id,
        subsystemId,
        systemId,
        encryptedData: data,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(subsystemMemberships)
        .where(eq(subsystemMemberships.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.subsystemId).toBe(subsystemId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("cascades on subsystem deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystemMemberships).values({
        id,
        subsystemId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
      });

      await db.delete(subsystems).where(eq(subsystems.id, subsystemId));
      const rows = await db
        .select()
        .from(subsystemMemberships)
        .where(eq(subsystemMemberships.id, id));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystemMemberships).values({
        id,
        subsystemId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(subsystemMemberships)
        .where(eq(subsystemMemberships.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent subsystemId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(subsystemMemberships).values({
          id: crypto.randomUUID(),
          subsystemId: "nonexistent",
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("side_system_memberships", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([44, 55, 66]));

      await db.insert(sideSystemMemberships).values({
        id,
        sideSystemId,
        systemId,
        encryptedData: data,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(sideSystemMemberships)
        .where(eq(sideSystemMemberships.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sideSystemId).toBe(sideSystemId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("cascades on side system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(sideSystemMemberships).values({
        id,
        sideSystemId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
      });

      await db.delete(sideSystems).where(eq(sideSystems.id, sideSystemId));
      const rows = await db
        .select()
        .from(sideSystemMemberships)
        .where(eq(sideSystemMemberships.id, id));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(sideSystemMemberships).values({
        id,
        sideSystemId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(sideSystemMemberships)
        .where(eq(sideSystemMemberships.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("layer_memberships", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const layerId = await insertLayer(systemId, 0);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([77, 88, 99]));

      await db.insert(layerMemberships).values({
        id,
        layerId,
        systemId,
        encryptedData: data,
        createdAt: now,
      });

      const rows = await db.select().from(layerMemberships).where(eq(layerMemberships.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.layerId).toBe(layerId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("cascades on layer deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const layerId = await insertLayer(systemId, 0);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(layerMemberships).values({
        id,
        layerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
      });

      await db.delete(layers).where(eq(layers.id, layerId));
      const rows = await db.select().from(layerMemberships).where(eq(layerMemberships.id, id));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const layerId = await insertLayer(systemId, 0);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(layerMemberships).values({
        id,
        layerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(layerMemberships).where(eq(layerMemberships.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  // ── Cross-links ───────────────────────────────────────────────────

  describe("subsystem_layer_links", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([1, 2]));

      await db.insert(subsystemLayerLinks).values({
        id,
        subsystemId,
        layerId,
        systemId,
        encryptedData: data,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.subsystemId).toBe(subsystemId);
      expect(rows[0]?.layerId).toBe(layerId);
    });

    it("allows nullable encryptedData", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystemLayerLinks).values({
        id,
        subsystemId,
        layerId,
        systemId,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, id));
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("rejects duplicate subsystemId+layerId pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const now = Date.now();

      await db.insert(subsystemLayerLinks).values({
        id: crypto.randomUUID(),
        subsystemId,
        layerId,
        systemId,
        createdAt: now,
      });

      await expect(
        db.insert(subsystemLayerLinks).values({
          id: crypto.randomUUID(),
          subsystemId,
          layerId,
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on subsystem deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const linkId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystemLayerLinks).values({
        id: linkId,
        subsystemId,
        layerId,
        systemId,
        createdAt: now,
      });

      await db.delete(subsystems).where(eq(subsystems.id, subsystemId));
      const rows = await db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, linkId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on layer deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const linkId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystemLayerLinks).values({
        id: linkId,
        subsystemId,
        layerId,
        systemId,
        createdAt: now,
      });

      await db.delete(layers).where(eq(layers.id, layerId));
      const rows = await db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, linkId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent subsystemId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const layerId = await insertLayer(systemId, 0);
      const now = Date.now();

      await expect(
        db.insert(subsystemLayerLinks).values({
          id: crypto.randomUUID(),
          subsystemId: "nonexistent",
          layerId,
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent layerId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const now = Date.now();

      await expect(
        db.insert(subsystemLayerLinks).values({
          id: crypto.randomUUID(),
          subsystemId,
          layerId: "nonexistent",
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("subsystem_side_system_links", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const sideSystemId = await insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([3, 4]));

      await db.insert(subsystemSideSystemLinks).values({
        id,
        subsystemId,
        sideSystemId,
        systemId,
        encryptedData: data,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(subsystemSideSystemLinks)
        .where(eq(subsystemSideSystemLinks.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.subsystemId).toBe(subsystemId);
      expect(rows[0]?.sideSystemId).toBe(sideSystemId);
    });

    it("rejects duplicate subsystemId+sideSystemId pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const sideSystemId = await insertSideSystem(systemId);
      const now = Date.now();

      await db.insert(subsystemSideSystemLinks).values({
        id: crypto.randomUUID(),
        subsystemId,
        sideSystemId,
        systemId,
        createdAt: now,
      });

      await expect(
        db.insert(subsystemSideSystemLinks).values({
          id: crypto.randomUUID(),
          subsystemId,
          sideSystemId,
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on subsystem deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const sideSystemId = await insertSideSystem(systemId);
      const linkId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystemSideSystemLinks).values({
        id: linkId,
        subsystemId,
        sideSystemId,
        systemId,
        createdAt: now,
      });

      await db.delete(subsystems).where(eq(subsystems.id, subsystemId));
      const rows = await db
        .select()
        .from(subsystemSideSystemLinks)
        .where(eq(subsystemSideSystemLinks.id, linkId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on side system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const sideSystemId = await insertSideSystem(systemId);
      const linkId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(subsystemSideSystemLinks).values({
        id: linkId,
        subsystemId,
        sideSystemId,
        systemId,
        createdAt: now,
      });

      await db.delete(sideSystems).where(eq(sideSystems.id, sideSystemId));
      const rows = await db
        .select()
        .from(subsystemSideSystemLinks)
        .where(eq(subsystemSideSystemLinks.id, linkId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent subsystemId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const now = Date.now();

      await expect(
        db.insert(subsystemSideSystemLinks).values({
          id: crypto.randomUUID(),
          subsystemId: "nonexistent",
          sideSystemId,
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent sideSystemId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const subsystemId = await insertSubsystem(systemId);
      const now = Date.now();

      await expect(
        db.insert(subsystemSideSystemLinks).values({
          id: crypto.randomUUID(),
          subsystemId,
          sideSystemId: "nonexistent",
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("side_system_layer_links", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([5, 6]));

      await db.insert(sideSystemLayerLinks).values({
        id,
        sideSystemId,
        layerId,
        systemId,
        encryptedData: data,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(sideSystemLayerLinks)
        .where(eq(sideSystemLayerLinks.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sideSystemId).toBe(sideSystemId);
      expect(rows[0]?.layerId).toBe(layerId);
    });

    it("rejects duplicate sideSystemId+layerId pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const now = Date.now();

      await db.insert(sideSystemLayerLinks).values({
        id: crypto.randomUUID(),
        sideSystemId,
        layerId,
        systemId,
        createdAt: now,
      });

      await expect(
        db.insert(sideSystemLayerLinks).values({
          id: crypto.randomUUID(),
          sideSystemId,
          layerId,
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on side system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const linkId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(sideSystemLayerLinks).values({
        id: linkId,
        sideSystemId,
        layerId,
        systemId,
        createdAt: now,
      });

      await db.delete(sideSystems).where(eq(sideSystems.id, sideSystemId));
      const rows = await db
        .select()
        .from(sideSystemLayerLinks)
        .where(eq(sideSystemLayerLinks.id, linkId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on layer deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const layerId = await insertLayer(systemId, 0);
      const linkId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(sideSystemLayerLinks).values({
        id: linkId,
        sideSystemId,
        layerId,
        systemId,
        createdAt: now,
      });

      await db.delete(layers).where(eq(layers.id, layerId));
      const rows = await db
        .select()
        .from(sideSystemLayerLinks)
        .where(eq(sideSystemLayerLinks.id, linkId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent sideSystemId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const layerId = await insertLayer(systemId, 0);
      const now = Date.now();

      await expect(
        db.insert(sideSystemLayerLinks).values({
          id: crypto.randomUUID(),
          sideSystemId: "nonexistent",
          layerId,
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent layerId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sideSystemId = await insertSideSystem(systemId);
      const now = Date.now();

      await expect(
        db.insert(sideSystemLayerLinks).values({
          id: crypto.randomUUID(),
          sideSystemId,
          layerId: "nonexistent",
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });
  });
});
