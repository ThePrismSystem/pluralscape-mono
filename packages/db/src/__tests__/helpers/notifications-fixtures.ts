/**
 * Shared fixtures for PG notifications schema integration tests.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import {
  deviceTokens,
  friendNotificationPreferences,
  notificationConfigs,
} from "../../schema/pg/notifications.js";
import { friendConnections } from "../../schema/pg/privacy.js";
import { systems } from "../../schema/pg/systems.js";

import { createPgNotificationTables, pgInsertAccount, pgInsertSystem } from "./pg-helpers.js";

import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const notificationsSchema = {
  accounts,
  systems,
  friendConnections,
  deviceTokens,
  notificationConfigs,
  friendNotificationPreferences,
};

export type NotificationsDb = PgliteDatabase<typeof notificationsSchema>;

export interface NotificationsFixture {
  client: PGlite;
  db: NotificationsDb;
}

export async function setupNotificationsFixture(): Promise<NotificationsFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: notificationsSchema });
  await createPgNotificationTables(client);
  return { client, db };
}

export async function teardownNotificationsFixture(fixture: NotificationsFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearNotificationsTables(db: NotificationsDb): Promise<void> {
  await db.delete(friendNotificationPreferences);
  await db.delete(notificationConfigs);
  await db.delete(deviceTokens);
  await db.delete(friendConnections);
}

export const insertAccount = (db: NotificationsDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (
  db: NotificationsDb,
  accountId: AccountId,
  id?: string,
): Promise<SystemId> => pgInsertSystem(db, accountId, id);
