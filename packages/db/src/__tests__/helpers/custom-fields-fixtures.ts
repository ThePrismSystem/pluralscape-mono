/**
 * Shared fixtures for PG custom fields schema integration tests.
 *
 * Used by schema-pg-custom-fields-definitions-scopes,
 * -values-bucket-visibility, and -polymorphism splits.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import {
  fieldBucketVisibility,
  fieldDefinitionScopes,
  fieldDefinitions,
  fieldValues,
} from "../../schema/pg/custom-fields.js";
import { groups } from "../../schema/pg/groups.js";
import { buckets } from "../../schema/pg/privacy.js";
import { systemStructureEntities, systemStructureEntityTypes } from "../../schema/pg/structure.js";
import { systems } from "../../schema/pg/systems.js";
import { fixtureNow } from "../fixtures/timestamps.js";

import {
  createPgCustomFieldsTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./pg-helpers.js";

import type { AccountId, BucketId, FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const customFieldsSchema = {
  accounts,
  systems,
  buckets,
  groups,
  systemStructureEntityTypes,
  systemStructureEntities,
  fieldDefinitions,
  fieldDefinitionScopes,
  fieldValues,
  fieldBucketVisibility,
};

export type CustomFieldsDb = PgliteDatabase<typeof customFieldsSchema>;

export interface CustomFieldsFixture {
  client: PGlite;
  db: CustomFieldsDb;
}

export async function setupCustomFieldsFixture(): Promise<CustomFieldsFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: customFieldsSchema });
  await createPgCustomFieldsTables(client);
  return { client, db };
}

export async function teardownCustomFieldsFixture(fixture: CustomFieldsFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearCustomFieldsTables(db: CustomFieldsDb): Promise<void> {
  await db.delete(fieldBucketVisibility);
  await db.delete(fieldValues);
  await db.delete(fieldDefinitions);
}

export const insertAccount = (db: CustomFieldsDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (
  db: CustomFieldsDb,
  accountId: string,
  id?: string,
): Promise<SystemId> => pgInsertSystem(db, accountId, id);

export async function insertBucket(
  db: CustomFieldsDb,
  systemId: SystemId,
  id: BucketId = brandId<BucketId>(crypto.randomUUID()),
): Promise<BucketId> {
  const now = fixtureNow();
  await db.insert(buckets).values({
    id,
    systemId,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function insertFieldDefinition(
  db: CustomFieldsDb,
  systemId: SystemId,
  id: FieldDefinitionId = brandId<FieldDefinitionId>(crypto.randomUUID()),
): Promise<FieldDefinitionId> {
  const now = fixtureNow();
  await db.insert(fieldDefinitions).values({
    id,
    systemId,
    fieldType: "text",
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
