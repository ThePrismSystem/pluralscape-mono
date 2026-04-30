/**
 * Shared fixtures for PG import-export schema integration tests.
 *
 * Used by schema-pg-import-jobs, -export-purge, and
 * -checkpoint-refs splits.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import {
  accountPurgeRequests,
  exportRequests,
  importEntityRefs,
  importJobs,
} from "../../schema/pg/import-export.js";
import { systems } from "../../schema/pg/systems.js";

import { createPgImportExportTables, pgInsertAccount, pgInsertSystem } from "./pg-helpers.js";

import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const importExportSchema = {
  accounts,
  systems,
  importJobs,
  importEntityRefs,
  exportRequests,
  accountPurgeRequests,
};

export type ImportExportDb = PgliteDatabase<typeof importExportSchema>;

export interface ImportExportFixture {
  client: PGlite;
  db: ImportExportDb;
}

export async function setupImportExportFixture(): Promise<ImportExportFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: importExportSchema });
  await createPgImportExportTables(client);
  return { client, db };
}

export async function teardownImportExportFixture(fixture: ImportExportFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearImportExportTables(db: ImportExportDb): Promise<void> {
  await db.delete(importEntityRefs);
  await db.delete(importJobs);
  await db.delete(exportRequests);
  await db.delete(accountPurgeRequests);
}

export const insertAccount = (db: ImportExportDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (
  db: ImportExportDb,
  accountId: string,
  id?: string,
): Promise<SystemId> => pgInsertSystem(db, accountId, id);
