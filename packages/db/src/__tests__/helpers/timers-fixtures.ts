/**
 * Shared fixtures for PG timers schema integration tests.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import { members } from "../../schema/pg/members.js";
import { systems } from "../../schema/pg/systems.js";
import { checkInRecords, timerConfigs } from "../../schema/pg/timers.js";

import {
  createPgTimerTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "./pg-helpers.js";

import type { AccountId, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const timersSchema = { accounts, systems, members, timerConfigs, checkInRecords };

export type TimersDb = PgliteDatabase<typeof timersSchema>;

export interface TimersFixture {
  client: PGlite;
  db: TimersDb;
}

export async function setupTimersFixture(): Promise<TimersFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: timersSchema });
  await createPgTimerTables(client);
  return { client, db };
}

export async function teardownTimersFixture(fixture: TimersFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearTimersTables(db: TimersDb): Promise<void> {
  await db.delete(checkInRecords);
  await db.delete(timerConfigs);
}

export const insertAccount = (db: TimersDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (db: TimersDb, accountId: string, id?: string): Promise<SystemId> =>
  pgInsertSystem(db, accountId, id);
export const insertMember = (db: TimersDb, systemId: string, id?: string): Promise<MemberId> =>
  pgInsertMember(db, systemId, id);
