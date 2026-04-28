/**
 * Three-way schema parity tests for ADR-038.
 *
 * Verifies that for each materialized entity:
 * 1. Server-PG, server-SQLite, and client-cache schemas share equivalent
 *    structural columns (id, systemId, timestamps, archivable).
 * 2. The cache schema's variant columns map onto the domain type's fields
 *    per the encoding rules in ADR-038.
 *
 * Type-level identity (each cache column's TypeScript type matches the
 * corresponding domain field) is enforced by `$type<T>()` annotations on the
 * column builders combined with the type-level extends checks below.
 */

import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import * as pgSchema from "../schema/pg/index.js";
import * as sqliteSchema from "../schema/sqlite/index.js";
import * as cache from "../schema/sqlite-client-cache/index.js";

import { assertStructuralColumnsEquivalent } from "./helpers/three-way-parity.js";

import type {
  CustomFront,
  FrontingComment,
  FrontingSession,
  Group,
  GroupMembership,
  Member,
  MemberPhoto,
  System,
} from "@pluralscape/types";
import type { InferSelectModel, Table } from "drizzle-orm";

const SERVER_ONLY_COLUMNS = ["encryptedData", "version"] as const;

// ── Parameterized structural parity ───────────────────────────────────
// Every materialized SyncedEntityType is covered here so a future schema
// addition fails the gate at CI time even if the author forgets to add a
// dedicated describe block. The hand-written blocks below additionally
// pin domain↔cache parity at the type level for the most-used entities.

interface StructuralParityCase {
  readonly name: string;
  readonly pg: Table | null;
  readonly sqlite: Table | null;
  readonly cache: Table;
  readonly skip: readonly string[];
}

const STRUCTURAL_PARITY_CASES: readonly StructuralParityCase[] = [
  // system-core
  // systems: server stores `accountId` (per-tenant FK to accounts) — cache is single-account, no accountId.
  {
    name: "systems",
    pg: pgSchema.systems,
    sqlite: sqliteSchema.systems,
    cache: cache.systems,
    skip: [...SERVER_ONLY_COLUMNS, "accountId"],
  },
  // systemSettings: `pinHash` and `biometricEnabled` are app-lock auth state — server-side, kept off the cache (the cache mirrors only synced settings).
  {
    name: "systemSettings",
    pg: pgSchema.systemSettings,
    sqlite: sqliteSchema.systemSettings,
    cache: cache.systemSettings,
    skip: [...SERVER_ONLY_COLUMNS, "pinHash", "biometricEnabled"],
  },
  {
    name: "members",
    pg: pgSchema.members,
    sqlite: sqliteSchema.members,
    cache: cache.members,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "memberPhotos",
    pg: pgSchema.memberPhotos,
    sqlite: sqliteSchema.memberPhotos,
    cache: cache.memberPhotos,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "groups",
    pg: pgSchema.groups,
    sqlite: sqliteSchema.groups,
    cache: cache.groups,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  // group_memberships intentionally skipped — junction tables are not entityIdentity-shaped.
  {
    name: "systemStructureEntityTypes",
    pg: pgSchema.systemStructureEntityTypes,
    sqlite: sqliteSchema.systemStructureEntityTypes,
    cache: cache.systemStructureEntityTypes,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "systemStructureEntities",
    pg: pgSchema.systemStructureEntities,
    sqlite: sqliteSchema.systemStructureEntities,
    cache: cache.systemStructureEntities,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "systemStructureEntityLinks",
    pg: pgSchema.systemStructureEntityLinks,
    sqlite: sqliteSchema.systemStructureEntityLinks,
    cache: cache.systemStructureEntityLinks,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "systemStructureEntityMemberLinks",
    pg: pgSchema.systemStructureEntityMemberLinks,
    sqlite: sqliteSchema.systemStructureEntityMemberLinks,
    cache: cache.systemStructureEntityMemberLinks,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "systemStructureEntityAssociations",
    pg: pgSchema.systemStructureEntityAssociations,
    sqlite: sqliteSchema.systemStructureEntityAssociations,
    cache: cache.systemStructureEntityAssociations,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "relationships",
    pg: pgSchema.relationships,
    sqlite: sqliteSchema.relationships,
    cache: cache.relationships,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "customFronts",
    pg: pgSchema.customFronts,
    sqlite: sqliteSchema.customFronts,
    cache: cache.customFronts,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "frontingReports",
    pg: pgSchema.frontingReports,
    sqlite: sqliteSchema.frontingReports,
    cache: cache.frontingReports,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "fieldDefinitions",
    pg: pgSchema.fieldDefinitions,
    sqlite: sqliteSchema.fieldDefinitions,
    cache: cache.fieldDefinitions,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "fieldValues",
    pg: pgSchema.fieldValues,
    sqlite: sqliteSchema.fieldValues,
    cache: cache.fieldValues,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "innerworldEntities",
    pg: pgSchema.innerworldEntities,
    sqlite: sqliteSchema.innerworldEntities,
    cache: cache.innerworldEntities,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "innerworldRegions",
    pg: pgSchema.innerworldRegions,
    sqlite: sqliteSchema.innerworldRegions,
    cache: cache.innerworldRegions,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "innerworldCanvas",
    pg: pgSchema.innerworldCanvas,
    sqlite: sqliteSchema.innerworldCanvas,
    cache: cache.innerworldCanvas,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  // timerConfigs: server denormalises `nextCheckInAt` for cron-driven dispatch — cache derives at read time.
  {
    name: "timerConfigs",
    pg: pgSchema.timerConfigs,
    sqlite: sqliteSchema.timerConfigs,
    cache: cache.timerConfigs,
    skip: [...SERVER_ONLY_COLUMNS, "nextCheckInAt"],
  },
  // lifecycle-events: server stores `plaintextMetadata`/`updatedAt`; cache uses typed `payload`.
  {
    name: "lifecycleEvents",
    pg: pgSchema.lifecycleEvents,
    sqlite: sqliteSchema.lifecycleEvents,
    cache: cache.lifecycleEvents,
    skip: [...SERVER_ONLY_COLUMNS, "plaintextMetadata", "updatedAt"],
  },
  // webhookConfigs: HMAC `secret` is server-only T3 metadata (see review-cleanup 2a) — never replicated.
  {
    name: "webhookConfigs",
    pg: pgSchema.webhookConfigs,
    sqlite: sqliteSchema.webhookConfigs,
    cache: cache.webhookConfigs,
    skip: [...SERVER_ONLY_COLUMNS, "secret"],
  },
  // fronting
  {
    name: "frontingSessions",
    pg: pgSchema.frontingSessions,
    sqlite: sqliteSchema.frontingSessions,
    cache: cache.frontingSessions,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "frontingComments",
    pg: pgSchema.frontingComments,
    sqlite: sqliteSchema.frontingComments,
    cache: cache.frontingComments,
    skip: [...SERVER_ONLY_COLUMNS, "sessionStartTime"],
  },
  // checkInRecords: server stores `idempotencyKey` for replay protection on the timer endpoint — cache only sees materialized records.
  {
    name: "checkInRecords",
    pg: pgSchema.checkInRecords,
    sqlite: sqliteSchema.checkInRecords,
    cache: cache.checkInRecords,
    skip: [...SERVER_ONLY_COLUMNS, "idempotencyKey"],
  },
  // chat
  {
    name: "channels",
    pg: pgSchema.channels,
    sqlite: sqliteSchema.channels,
    cache: cache.channels,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "messages",
    pg: pgSchema.messages,
    sqlite: sqliteSchema.messages,
    cache: cache.messages,
    skip: [...SERVER_ONLY_COLUMNS, "timestamp"],
  },
  {
    name: "boardMessages",
    pg: pgSchema.boardMessages,
    sqlite: sqliteSchema.boardMessages,
    cache: cache.boardMessages,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "polls",
    pg: pgSchema.polls,
    sqlite: sqliteSchema.polls,
    cache: cache.polls,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  // poll-options have no PG/SQLite server table — they live inside the parent poll's encryptedData.
  { name: "pollOptions", pg: null, sqlite: null, cache: cache.pollOptions, skip: [] },
  // pollVotes: server stores polymorphic `voter` as a JSON column — cache flattens into discriminator columns (voterEntityType/voterEntityId).
  {
    name: "pollVotes",
    pg: pgSchema.pollVotes,
    sqlite: sqliteSchema.pollVotes,
    cache: cache.pollVotes,
    skip: [...SERVER_ONLY_COLUMNS, "voter"],
  },
  {
    name: "acknowledgements",
    pg: pgSchema.acknowledgements,
    sqlite: sqliteSchema.acknowledgements,
    cache: cache.acknowledgements,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  // journal
  {
    name: "journalEntries",
    pg: pgSchema.journalEntries,
    sqlite: sqliteSchema.journalEntries,
    cache: cache.journalEntries,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "wikiPages",
    pg: pgSchema.wikiPages,
    sqlite: sqliteSchema.wikiPages,
    cache: cache.wikiPages,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "notes",
    pg: pgSchema.notes,
    sqlite: sqliteSchema.notes,
    cache: cache.notes,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  // privacy
  {
    name: "buckets",
    pg: pgSchema.buckets,
    sqlite: sqliteSchema.buckets,
    cache: cache.buckets,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  // bucket_content_tags + field_bucket_visibility: junction tables, no entityIdentity.
  {
    name: "friendConnections",
    pg: pgSchema.friendConnections,
    sqlite: sqliteSchema.friendConnections,
    cache: cache.friendConnections,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "friendCodes",
    pg: pgSchema.friendCodes,
    sqlite: sqliteSchema.friendCodes,
    cache: cache.friendCodes,
    skip: [...SERVER_ONLY_COLUMNS],
  },
  {
    name: "keyGrants",
    pg: pgSchema.keyGrants,
    sqlite: sqliteSchema.keyGrants,
    cache: cache.keyGrants,
    skip: [...SERVER_ONLY_COLUMNS],
  },
];

describe.each(STRUCTURAL_PARITY_CASES)(
  "three-way structural parity — $name",
  ({ pg, sqlite, cache: cacheTable, skip }) => {
    test.skipIf(pg === null)("server PG ↔ cache structural columns equivalent", () => {
      if (pg === null) return;
      assertStructuralColumnsEquivalent(getTableColumns(pg), getTableColumns(cacheTable), { skip });
    });

    test.skipIf(sqlite === null)("server SQLite ↔ cache structural columns equivalent", () => {
      if (sqlite === null) return;
      assertStructuralColumnsEquivalent(getTableColumns(sqlite), getTableColumns(cacheTable), {
        skip,
      });
    });
  },
);

type SystemStructuralKey = "id" | "createdAt" | "updatedAt" | "archived" | "archivedAt";
type EntityStructuralKey = SystemStructuralKey | "systemId";

type StringKeys<T> = Extract<keyof T, string>;
type AssertSubset<Sub extends Super, Super> = Sub;

describe("three-way schema parity — members", () => {
  test("server PG ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(pgSchema.members),
      getTableColumns(cache.members),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("server SQLite ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(sqliteSchema.members),
      getTableColumns(cache.members),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("cache columns ↔ Member domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.members>>;
    type VariantKeys = Exclude<ColKeys, EntityStructuralKey>;
    type _Check = AssertSubset<VariantKeys, keyof Member>;
    const sentinel: _Check = "name";
    expect(sentinel).toBe("name");
  });
});

describe("three-way schema parity — member_photos", () => {
  test("server PG ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(pgSchema.memberPhotos),
      getTableColumns(cache.memberPhotos),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("server SQLite ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(sqliteSchema.memberPhotos),
      getTableColumns(cache.memberPhotos),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("cache columns ↔ MemberPhoto domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.memberPhotos>>;
    type VariantKeys = Exclude<ColKeys, EntityStructuralKey | "memberId">;
    type _Check = AssertSubset<VariantKeys, keyof MemberPhoto>;
    const sentinel: _Check = "imageSource";
    expect(sentinel).toBe("imageSource");
  });
});

describe("three-way schema parity — system", () => {
  test("cache columns ↔ System domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.systems>>;
    type VariantKeys = Exclude<ColKeys, SystemStructuralKey>;
    type _Check = AssertSubset<VariantKeys, keyof System>;
    const sentinel: _Check = "name";
    expect(sentinel).toBe("name");
  });
});

describe("three-way schema parity — groups", () => {
  test("server PG ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(pgSchema.groups),
      getTableColumns(cache.groups),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("server SQLite ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(sqliteSchema.groups),
      getTableColumns(cache.groups),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("cache columns ↔ Group domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.groups>>;
    type VariantKeys = Exclude<ColKeys, EntityStructuralKey>;
    type _Check = AssertSubset<VariantKeys, keyof Group>;
    const sentinel: _Check = "name";
    expect(sentinel).toBe("name");
  });
});

describe("three-way schema parity — group_memberships", () => {
  test("cache columns ↔ GroupMembership domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.groupMemberships>>;
    // `id` is the compound CRDT key (junction-storage carve-out, ADR-038);
    // not present on the domain GroupMembership type.
    type VariantKeys = Exclude<ColKeys, "id">;
    type _Check = AssertSubset<VariantKeys, keyof GroupMembership>;
    const sentinel: _Check = "groupId";
    expect(sentinel).toBe("groupId");
  });
});

describe("three-way schema parity — custom_fronts", () => {
  test("server PG ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(pgSchema.customFronts),
      getTableColumns(cache.customFronts),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("server SQLite ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(sqliteSchema.customFronts),
      getTableColumns(cache.customFronts),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("cache columns ↔ CustomFront domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.customFronts>>;
    type VariantKeys = Exclude<ColKeys, EntityStructuralKey>;
    type _Check = AssertSubset<VariantKeys, keyof CustomFront>;
    const sentinel: _Check = "name";
    expect(sentinel).toBe("name");
  });
});

describe("three-way schema parity — fronting_sessions", () => {
  test("cache columns ↔ FrontingSession domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.frontingSessions>>;
    type VariantKeys = Exclude<ColKeys, EntityStructuralKey>;
    type _Check = AssertSubset<VariantKeys, keyof FrontingSession>;
    const sentinel: _Check = "startTime";
    expect(sentinel).toBe("startTime");
  });
});

describe("three-way schema parity — fronting_comments", () => {
  test("server PG ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(pgSchema.frontingComments),
      getTableColumns(cache.frontingComments),
      // sessionStartTime is a PG-only denormalised column for partitioning.
      { skip: [...SERVER_ONLY_COLUMNS, "sessionStartTime"] },
    );
  });

  test("server SQLite ↔ cache structural columns equivalent", () => {
    assertStructuralColumnsEquivalent(
      getTableColumns(sqliteSchema.frontingComments),
      getTableColumns(cache.frontingComments),
      { skip: [...SERVER_ONLY_COLUMNS] },
    );
  });

  test("cache columns ↔ FrontingComment domain fields", () => {
    type ColKeys = StringKeys<InferSelectModel<typeof cache.frontingComments>>;
    type VariantKeys = Exclude<ColKeys, EntityStructuralKey>;
    type _Check = AssertSubset<VariantKeys, keyof FrontingComment>;
    const sentinel: _Check = "content";
    expect(sentinel).toBe("content");
  });
});
