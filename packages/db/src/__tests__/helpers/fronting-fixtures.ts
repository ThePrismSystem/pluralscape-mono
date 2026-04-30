/**
 * Shared fixtures for PG fronting schema integration tests.
 *
 * Used by schema-pg-fronting-sessions-core, -sessions-archived,
 * -custom-fronts, and -comments splits.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import { customFronts, frontingComments, frontingSessions } from "../../schema/pg/fronting.js";
import { members } from "../../schema/pg/members.js";
import { systems } from "../../schema/pg/systems.js";
import { fixtureNow } from "../fixtures/timestamps.js";

import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./pg-helpers.js";

import type {
  AccountId,
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const frontingSchema = {
  accounts,
  systems,
  members,
  frontingSessions,
  customFronts,
  frontingComments,
};

export type FrontingDb = PgliteDatabase<typeof frontingSchema>;

export interface FrontingFixture {
  client: PGlite;
  db: FrontingDb;
}

export async function setupFrontingFixture(): Promise<FrontingFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: frontingSchema });
  await createPgFrontingTables(client);
  return { client, db };
}

export async function teardownFrontingFixture(fixture: FrontingFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearFrontingTables(db: FrontingDb): Promise<void> {
  await db.delete(frontingComments);
  await db.delete(frontingSessions);
  await db.delete(customFronts);
}

export const insertAccount = (db: FrontingDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (db: FrontingDb, accountId: string, id?: string): Promise<SystemId> =>
  pgInsertSystem(db, accountId, id);
export const insertMember = (db: FrontingDb, systemId: SystemId, id?: string): Promise<MemberId> =>
  pgInsertMember(db, systemId, id);

export async function insertCustomFront(
  db: FrontingDb,
  systemId: string,
  raw?: string,
): Promise<CustomFrontId> {
  const id = brandId<CustomFrontId>(raw ?? crypto.randomUUID());
  const now = fixtureNow();
  await db.insert(customFronts).values({
    id,
    systemId: brandId<SystemId>(systemId),
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function insertFrontingSession(
  db: FrontingDb,
  systemId: SystemId,
  id?: string,
): Promise<{ id: FrontingSessionId; startTime: UnixMillis }> {
  const sessionId = brandId<FrontingSessionId>(id ?? crypto.randomUUID());
  const now = fixtureNow();
  const memberId = await insertMember(db, systemId);
  await db.insert(frontingSessions).values({
    id: sessionId,
    systemId,
    startTime: now,
    memberId,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return { id: sessionId, startTime: now };
}
