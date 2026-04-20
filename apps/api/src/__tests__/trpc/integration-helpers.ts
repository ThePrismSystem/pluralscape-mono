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
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";

import { createBucket } from "../../services/bucket.service.js";
import { generateFriendCode, redeemFriendCode } from "../../services/friend-code.service.js";
import { createFrontingSession } from "../../services/fronting-session.service.js";
import { createMember } from "../../services/member.service.js";
import { createStructureEntity } from "../../services/structure-entity-crud.service.js";
import { createEntityType } from "../../services/structure-entity-type.service.js";
import { router } from "../../trpc/trpc.js";
import {
  asDb,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import { makeIntegrationCallerFactory } from "./test-helpers.js";

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

/**
 * Seed an *accepted* friend connection between two tenants by first
 * generating + redeeming a friend code (which produces a PENDING pair),
 * then flipping both rows to ACCEPTED via direct SQL.
 *
 * Bypasses `acceptFriendConnection` so this helper doesn't depend on the
 * friend router being correctly wired — useful for downstream router
 * tests (bucket assignment, etc.) that need an `accepted` precondition.
 *
 * Returns the connection id owned by the redeemer (`b`), matching
 * `seedFriendConnection`'s contract.
 */
export async function seedAcceptedFriendConnection(
  db: PostgresJsDatabase,
  a: SeededTenant,
  b: SeededTenant,
): Promise<FriendConnectionId> {
  const connectionId = await seedFriendConnection(db, a, b);
  // Flip both sides to "accepted" — assignBucketToFriend only inspects the
  // owner's row, but the reverse row is updated for consistency with the
  // production accept path.
  await db
    .update(schema.friendConnections)
    .set({ status: "accepted" })
    .where(eq(schema.friendConnections.accountId, a.accountId));
  await db
    .update(schema.friendConnections)
    .set({ status: "accepted" })
    .where(eq(schema.friendConnections.accountId, b.accountId));
  return connectionId;
}

// ── Router fixture ──────────────────────────────────────────────────
//
// `setupRouterFixture` registers the standard set of vitest hooks
// (beforeAll/afterAll/beforeEach/afterEach) used by every router
// integration test file. It returns lazy accessors so test bodies can
// read the per-test state (ctx, caller factory, two seeded tenants)
// without juggling `let` declarations and beforeEach mutation in every
// file.

/** Constraint matches `makeIntegrationCallerFactory`'s router-record shape. */
type RouterRecordInput = Parameters<typeof router>[0];

/**
 * Bundle of refs returned by `setupRouterFixture`. The accessors throw
 * if called outside a `beforeEach`/`it` body — they assume the fixture
 * has been populated by the registered hooks.
 */
export interface RouterFixtureAccessors<TRouters extends RouterRecordInput> {
  readonly getCtx: () => RouterIntegrationCtx;
  readonly getCaller: ReturnType<typeof makeIntegrationCallerFactory<TRouters>>;
  readonly getPrimary: () => SeededTenant;
  readonly getOther: () => SeededTenant;
}

export interface RouterFixtureOptions {
  /**
   * Extra teardown step to run after `truncateAll` in the per-test
   * `afterEach`. Wrapped in try/finally with `truncateAll` so it always
   * runs, even if `truncateAll` throws. Use for in-memory store resets
   * (auth login store, blob storage adapter, webhook config cache).
   */
  readonly extraAfterEach?: (ctx: RouterIntegrationCtx) => Promise<void> | void;
  /**
   * Mock-clearing step to run at the start of `beforeEach`, before tenant
   * seeding. Use for `vi.mocked(dispatchWebhookEvent).mockClear()` etc. —
   * required because `clearMocks: false` in vitest config means mock call
   * history accumulates across tests by default. Runs FIRST so the test
   * starts with a clean slate; tests that need finer-grained isolation
   * can `mockClear()` again immediately before the action under test.
   */
  readonly clearMocks?: () => void;
}

/**
 * Register the standard `beforeAll` / `afterAll` / `beforeEach` / `afterEach`
 * hooks for a tRPC router integration test file. Sets up PGlite once per
 * file, seeds a fresh primary + secondary tenant per test, and truncates
 * all tables between tests. Returns lazy accessors so the test bodies can
 * read the per-test state without dealing with `let` declarations and
 * `beforeEach` mutation in every file.
 */
export function setupRouterFixture<TRouters extends RouterRecordInput>(
  routers: TRouters,
  options: RouterFixtureOptions = {},
): RouterFixtureAccessors<TRouters> {
  let ctx: RouterIntegrationCtx | undefined;
  let makeCaller: ReturnType<typeof makeIntegrationCallerFactory<TRouters>> | undefined;
  let primary: SeededTenant | undefined;
  let other: SeededTenant | undefined;

  beforeAll(async () => {
    ctx = await setupRouterIntegration();
    makeCaller = makeIntegrationCallerFactory<TRouters>(routers, ctx.db);
  });

  afterAll(async () => {
    if (ctx) await ctx.teardown();
  });

  beforeEach(async () => {
    if (!ctx) throw new Error("setupRouterFixture: ctx not initialized");
    options.clearMocks?.();
    primary = await seedAccountAndSystem(ctx.db);
    other = await seedAccountAndSystem(ctx.db);
  });

  afterEach(async () => {
    if (!ctx) return;
    try {
      await truncateAll(ctx);
    } finally {
      await options.extraAfterEach?.(ctx);
    }
  });

  const getCaller: ReturnType<typeof makeIntegrationCallerFactory<TRouters>> = (auth) => {
    if (!makeCaller) throw new Error("getCaller() called outside of test body");
    return makeCaller(auth);
  };

  return {
    getCtx: () => {
      if (!ctx) throw new Error("getCtx() called outside of test body");
      return ctx;
    },
    getCaller,
    getPrimary: () => {
      if (!primary) throw new Error("getPrimary() called outside of test body");
      return primary;
    },
    getOther: () => {
      if (!other) throw new Error("getOther() called outside of test body");
      return other;
    },
  };
}
