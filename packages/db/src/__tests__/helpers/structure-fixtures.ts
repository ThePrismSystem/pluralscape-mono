/**
 * Shared fixtures for PG structure schema integration tests.
 *
 * Used by schema-pg-structure-relationships, -types-entities, -links, and
 * -member-links-associations to avoid duplicating PGlite setup, schema
 * binding, branded-ID factories, and insert wrappers.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import { members } from "../../schema/pg/members.js";
import {
  relationships,
  systemStructureEntityAssociations,
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "../../schema/pg/structure.js";
import { systems } from "../../schema/pg/systems.js";

import {
  createPgStructureTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "./pg-helpers.js";

import type {
  AccountId,
  MemberId,
  RelationshipId,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const structureSchema = {
  accounts,
  systems,
  members,
  relationships,
  systemStructureEntityTypes,
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityAssociations,
};

export type StructureDb = PgliteDatabase<typeof structureSchema>;

export interface StructureFixture {
  client: PGlite;
  db: StructureDb;
}

export async function setupStructureFixture(): Promise<StructureFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: structureSchema });
  await createPgStructureTables(client);
  return { client, db };
}

export async function teardownStructureFixture(fixture: StructureFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearStructureTables(db: StructureDb): Promise<void> {
  await db.delete(systemStructureEntityAssociations);
  await db.delete(systemStructureEntityMemberLinks);
  await db.delete(systemStructureEntityLinks);
  await db.delete(systemStructureEntities);
  await db.delete(systemStructureEntityTypes);
  await db.delete(relationships);
}

export const newRelId = (): RelationshipId => brandId<RelationshipId>(crypto.randomUUID());
export const newTypeId = (): SystemStructureEntityTypeId =>
  brandId<SystemStructureEntityTypeId>(crypto.randomUUID());
export const newEntityId = (): SystemStructureEntityId =>
  brandId<SystemStructureEntityId>(crypto.randomUUID());
export const newLinkId = (): SystemStructureEntityLinkId =>
  brandId<SystemStructureEntityLinkId>(crypto.randomUUID());
export const newMemberLinkId = (): SystemStructureEntityMemberLinkId =>
  brandId<SystemStructureEntityMemberLinkId>(crypto.randomUUID());
export const newAssocId = (): SystemStructureEntityAssociationId =>
  brandId<SystemStructureEntityAssociationId>(crypto.randomUUID());
export const asMemberId = (id: string): MemberId => brandId<MemberId>(id);

export const insertAccount = (db: StructureDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (db: StructureDb, accountId: string, id?: string): Promise<SystemId> =>
  pgInsertSystem(db, accountId, id);
export const insertMember = async (
  db: StructureDb,
  systemId: string,
  id?: string,
): Promise<MemberId> => brandId<MemberId>(await pgInsertMember(db, systemId, id));
