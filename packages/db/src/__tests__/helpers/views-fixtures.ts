/**
 * Shared fixtures for PG views / query helper integration tests.
 *
 * The views suite needs nearly the full table surface plus its own
 * cleanup ordering, so the helper builds the schema once and exposes
 * a per-test reset that keeps the per-suite seed (account/system/member)
 * intact.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { PG_DDL, pgExec, pgInsertAccount, pgInsertMember, pgInsertSystem } from "./pg-helpers.js";

import type { AccountId, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const CLEANUP_TABLES = [
  "fronting_comments",
  "fronting_sessions",
  "acknowledgements",
  "webhook_deliveries",
  "webhook_configs",
  "device_tokens",
  "friend_connections",
  "group_memberships",
  "groups",
  "api_keys",
  "device_transfer_requests",
  "sessions",
  "system_structure_entity_associations",
  "system_structure_entities",
  "system_structure_entity_types",
  "members",
  "systems",
  "accounts",
];

export interface ViewsFixture {
  client: PGlite;
  db: PgliteDatabase;
}

export async function setupViewsFixture(): Promise<ViewsFixture> {
  const client = await PGlite.create();
  const db = drizzle(client);
  // Base tables
  await pgExec(client, PG_DDL.accounts);
  await pgExec(client, PG_DDL.systems);
  await pgExec(client, PG_DDL.systemsIndexes);
  // Sessions & device transfer requests
  await pgExec(client, PG_DDL.sessions);
  await pgExec(client, PG_DDL.sessionsIndexes);
  await pgExec(client, PG_DDL.deviceTransferRequests);
  await pgExec(client, PG_DDL.deviceTransferRequestsIndexes);
  // Members (needed for groups)
  await pgExec(client, PG_DDL.members);
  // Structure (needed for fronting FKs)
  await pgExec(client, PG_DDL.systemStructureEntityTypes);
  await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
  await pgExec(client, PG_DDL.systemStructureEntities);
  await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
  // Fronting
  await pgExec(client, PG_DDL.customFronts);
  await pgExec(client, PG_DDL.customFrontsIndexes);
  await pgExec(client, PG_DDL.frontingSessions);
  await pgExec(client, PG_DDL.frontingSessionsIndexes);
  await pgExec(client, PG_DDL.frontingComments);
  await pgExec(client, PG_DDL.frontingCommentsIndexes);
  // API keys
  await pgExec(client, PG_DDL.apiKeys);
  await pgExec(client, PG_DDL.apiKeysIndexes);
  // Privacy (friend connections)
  await pgExec(client, PG_DDL.buckets);
  await pgExec(client, PG_DDL.friendConnections);
  await pgExec(client, PG_DDL.friendConnectionsIndexes);
  // Communication (acknowledgements)
  await pgExec(client, PG_DDL.acknowledgements);
  await pgExec(client, PG_DDL.acknowledgementsIndexes);
  // Groups
  await pgExec(client, PG_DDL.groups);
  await pgExec(client, PG_DDL.groupsIndexes);
  await pgExec(client, PG_DDL.groupMemberships);
  await pgExec(client, PG_DDL.groupMembershipsIndexes);
  // Notifications (device tokens)
  await pgExec(client, PG_DDL.deviceTokens);
  await pgExec(client, PG_DDL.deviceTokensIndexes);
  // Webhooks
  await pgExec(client, PG_DDL.webhookConfigs);
  await pgExec(client, PG_DDL.webhookConfigsIndexes);
  await pgExec(client, PG_DDL.webhookDeliveries);
  await pgExec(client, PG_DDL.webhookDeliveriesIndexes);
  // Structure relationships + associations
  await pgExec(client, PG_DDL.relationships);
  await pgExec(client, PG_DDL.systemStructureEntityAssociations);
  await pgExec(client, PG_DDL.systemStructureEntityAssociationsIndexes);
  return { client, db };
}

export async function teardownViewsFixture(fixture: ViewsFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearViewsTables(client: PGlite): Promise<void> {
  for (const table of CLEANUP_TABLES) {
    await client.exec(`DELETE FROM ${table}`);
  }
}

export interface ViewsSeed {
  accountId: AccountId;
  systemId: SystemId;
  memberId: MemberId;
}

export async function seedViewsBaseEntities(db: PgliteDatabase): Promise<ViewsSeed> {
  const accountId = await pgInsertAccount(db);
  const systemId = await pgInsertSystem(db, accountId);
  const memberId = await pgInsertMember(db, systemId);
  return { accountId, systemId, memberId };
}
