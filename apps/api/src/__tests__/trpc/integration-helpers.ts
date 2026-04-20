/**
 * Shared infrastructure for tRPC router integration tests.
 *
 * Used by all router files in `routers/*.integration.test.ts`. This is the
 * single source of truth for:
 *  - PGlite setup and teardown
 *  - Tenant seeding (account + system)
 *  - Entity seed helpers used by 3+ router files
 *  - Assertion helpers for auth and tenant errors
 *
 * Helpers used by only 1 router live inside that router's test file.
 * If a router-local helper turns out to be needed by another router,
 * promote it here — but not before.
 */
import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { expect } from "vitest";

import { createBucket } from "../../services/bucket.service.js";
import { generateFriendCode, redeemFriendCode } from "../../services/friend-code.service.js";
import { createFrontingSession } from "../../services/fronting-session.service.js";
import { createMember } from "../../services/member.service.js";
import { createStructureEntity } from "../../services/structure-entity-crud.service.js";
import { createEntityType } from "../../services/structure-entity-type.service.js";
import {
  asDb,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  FriendConnectionId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Row shape returned by `pg_tables` for table discovery. */
interface PgTablesRow {
  readonly tablename: string;
}

export interface RouterIntegrationCtx {
  readonly db: PostgresJsDatabase;
  readonly pglite: PGlite;
  readonly teardown: () => Promise<void>;
}

export async function setupRouterIntegration(): Promise<RouterIntegrationCtx> {
  const pglite = new PGlite();
  await createPgAllTables(pglite);
  const pgliteDb: PgliteDatabase<typeof schema> = drizzle(pglite, { schema });
  return {
    db: asDb(pgliteDb),
    pglite,
    teardown: async () => {
      await pglite.close();
    },
  };
}

/**
 * Truncate every table in the public schema with RESTART IDENTITY CASCADE.
 * Designed for `afterEach` between tests in a single file. Discovers tables
 * dynamically via the underlying PGlite handle so future schema additions
 * don't require updating this list.
 *
 * Takes the `RouterIntegrationCtx` rather than a bare `PostgresJsDatabase`
 * so we can use the typed PGlite query API for the discovery SELECT — the
 * postgres.js `db.execute()` `RowList` shape isn't usable without a cast.
 */
export async function truncateAll(ctx: RouterIntegrationCtx): Promise<void> {
  const result = await ctx.pglite.query<PgTablesRow>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const tables = result.rows
    .map((r) => r.tablename)
    .filter((t) => t !== "drizzle_migrations" && !t.startsWith("_"));
  if (tables.length === 0) return;
  const quoted = tables.map((t) => `"${t}"`).join(", ");
  await ctx.pglite.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
}

/** A fully-seeded tenant: account + system + a session AuthContext for it. */
export interface SeededTenant {
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly auth: AuthContext;
}

/**
 * Seed a fresh account + system pair and return a SeededTenant whose
 * AuthContext is suitable for invoking authenticated tRPC procedures.
 *
 * IDs are generated with the production `acc_<uuid>` / `sys_<uuid>` prefixes
 * because tRPC input validators (`brandedIdQueryParam`) reject bare UUIDs.
 * The DB schema stores them as opaque strings, so the prefix round-trips
 * cleanly through inserts and queries.
 */
export async function seedAccountAndSystem(db: PostgresJsDatabase): Promise<SeededTenant> {
  const accountIdRaw = `acc_${crypto.randomUUID()}`;
  const systemIdRaw = `sys_${crypto.randomUUID()}`;
  await pgInsertAccount(db, accountIdRaw);
  await pgInsertSystem(db, accountIdRaw, systemIdRaw);
  const accountId = brandId<AccountId>(accountIdRaw);
  const systemId = brandId<SystemId>(systemIdRaw);
  return {
    accountId,
    systemId,
    auth: makeAuth(accountId, systemId),
  };
}

/**
 * Convenience alias for seeding a second tenant in cross-tenant isolation tests.
 * Identical behaviour to `seedAccountAndSystem`; named explicitly to make the
 * intent at the call site clear.
 */
export async function seedSecondTenant(db: PostgresJsDatabase): Promise<SeededTenant> {
  return seedAccountAndSystem(db);
}

/**
 * Assert a promise rejects with a TRPCError carrying the UNAUTHORIZED code.
 * Use for tests that pass `null` as the auth context against a procedure
 * that requires authentication.
 */
export async function expectAuthRequired(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toThrow(
    expect.objectContaining({
      name: "TRPCError",
      code: "UNAUTHORIZED",
    }),
  );
}

/**
 * Assert a promise rejects with a TRPCError indicating cross-tenant access
 * was denied. Accepts both FORBIDDEN (explicit deny) and NOT_FOUND because
 * some scope guards mask cross-tenant entities as not-found rather than
 * forbidden to avoid leaking existence.
 */
export async function expectTenantDenied(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toThrow(
    expect.objectContaining({
      name: "TRPCError",
      code: expect.stringMatching(/^(FORBIDDEN|NOT_FOUND)$/),
    }),
  );
}

// ── Entity seed helpers ─────────────────────────────────────────────
//
// Each helper wraps the same service function the production routers call,
// so seeded state matches what end-to-end flows would produce. Helpers
// accept the minimum required parameters and use sensible defaults
// (encrypted blob, sortOrder, etc.) internally — add an `opts` parameter
// only when 2+ tests need to vary the seed shape.

/**
 * Seed a member belonging to the given system via the real `createMember`
 * service path. Returns the new member's branded id.
 */
export async function seedMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<MemberId> {
  const result = await createMember(
    db,
    systemId,
    { encryptedData: testEncryptedDataBase64() },
    auth,
    noopAudit,
  );
  return result.id;
}

/**
 * Seed a privacy bucket belonging to the given system via the real
 * `createBucket` service path. Returns the new bucket's branded id.
 */
export async function seedBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<BucketId> {
  const result = await createBucket(
    db,
    systemId,
    { encryptedData: testEncryptedDataBase64() },
    auth,
    noopAudit,
  );
  return result.id;
}

/** Default startTime offset (ms) used when seeding a fronting session. */
const FRONTING_SESSION_DEFAULT_START_OFFSET_MS = 0;

/**
 * Seed a fronting session attributed to the given member via the real
 * `createFrontingSession` service path. The member must already exist
 * in the system. Returns the new session's branded id.
 */
export async function seedFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  memberId: MemberId,
): Promise<FrontingSessionId> {
  const result = await createFrontingSession(
    db,
    systemId,
    {
      encryptedData: testEncryptedDataBase64(),
      startTime: Date.now() + FRONTING_SESSION_DEFAULT_START_OFFSET_MS,
      memberId,
    },
    auth,
    noopAudit,
  );
  return result.id;
}

/** Default sortOrder used when seeding entity types and entities. */
const STRUCTURE_DEFAULT_SORT_ORDER = 0;

/**
 * Seed a system structure entity via the real `createStructureEntity`
 * service path. Internally seeds a structure entity type first because
 * `createStructureEntity` rejects unknown type ids. Returns the new
 * entity's branded id.
 */
export async function seedStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<SystemStructureEntityId> {
  const entityType = await createEntityType(
    db,
    systemId,
    {
      encryptedData: testEncryptedDataBase64(),
      sortOrder: STRUCTURE_DEFAULT_SORT_ORDER,
    },
    auth,
    noopAudit,
  );
  const typeId: SystemStructureEntityTypeId = entityType.id;
  const result = await createStructureEntity(
    db,
    systemId,
    {
      structureEntityTypeId: typeId,
      encryptedData: testEncryptedDataBase64(),
      parentEntityId: null,
      sortOrder: STRUCTURE_DEFAULT_SORT_ORDER,
    },
    auth,
    noopAudit,
  );
  return result.id;
}

/**
 * Seed a bidirectional friend connection between two seeded tenants.
 *
 * Walks the real two-step flow: `a` generates a friend code and `b`
 * redeems it, creating mirrored connection rows. Returns the connection
 * id owned by the redeemer (`b`) — symmetrical to what a friend-list
 * query for `b` would surface.
 */
export async function seedFriendConnection(
  db: PostgresJsDatabase,
  a: SeededTenant,
  b: SeededTenant,
): Promise<FriendConnectionId> {
  const code = await generateFriendCode(db, a.accountId, a.auth, noopAudit);
  const result = await redeemFriendCode(db, code.code, b.auth, noopAudit);
  // connectionIds: [ownerSide, redeemerSide]; return the redeemer's row.
  return result.connectionIds[1];
}
