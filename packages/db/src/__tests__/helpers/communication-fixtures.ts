/**
 * Shared fixtures for PG communication schema integration tests.
 *
 * Used by schema-pg-communication-channels-messages, -board-notes,
 * -polls, and -acknowledgements to avoid duplicating PGlite setup,
 * schema binding, and insert wrappers.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import {
  acknowledgements,
  boardMessages,
  channels,
  messages,
  notes,
  polls,
  pollVotes,
} from "../../schema/pg/communication.js";
import { members } from "../../schema/pg/members.js";
import { systems } from "../../schema/pg/systems.js";

import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertChannel,
  pgInsertMember,
  pgInsertPoll,
  pgInsertSystem,
} from "./pg-helpers.js";

import type { AccountId, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const communicationSchema = {
  accounts,
  systems,
  members,
  channels,
  messages,
  boardMessages,
  notes,
  polls,
  pollVotes,
  acknowledgements,
};

export type CommunicationDb = PgliteDatabase<typeof communicationSchema>;

export interface CommunicationFixture {
  client: PGlite;
  db: CommunicationDb;
}

export async function setupCommunicationFixture(): Promise<CommunicationFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: communicationSchema });
  await createPgCommunicationTables(client);
  return { client, db };
}

export async function teardownCommunicationFixture(fixture: CommunicationFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearCommunicationTables(db: CommunicationDb): Promise<void> {
  await db.delete(acknowledgements);
  await db.delete(pollVotes);
  await db.delete(polls);
  await db.delete(boardMessages);
  await db.delete(notes);
  await db.delete(messages);
  await db.delete(channels);
}

export const insertAccount = (db: CommunicationDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (
  db: CommunicationDb,
  accountId: string,
  id?: string,
): Promise<SystemId> => pgInsertSystem(db, accountId, id);
export const insertMember = (
  db: CommunicationDb,
  systemId: string,
  id?: string,
): Promise<MemberId> => pgInsertMember(db, systemId, id);
export const insertChannel = (
  db: CommunicationDb,
  systemId: string,
  opts?: Parameters<typeof pgInsertChannel>[2],
): ReturnType<typeof pgInsertChannel> => pgInsertChannel(db, systemId, opts);
export const insertPoll = (
  db: CommunicationDb,
  systemId: string,
  opts?: Parameters<typeof pgInsertPoll>[2],
): ReturnType<typeof pgInsertPoll> => pgInsertPoll(db, systemId, opts);
