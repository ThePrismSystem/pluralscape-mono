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
import type { InferSelectModel } from "drizzle-orm";

const SERVER_ONLY_COLUMNS = ["encryptedData", "version"] as const;

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
    // systemId and createdAt are persistence metadata not present on the
    // domain GroupMembership type.
    type VariantKeys = Exclude<ColKeys, "systemId" | "createdAt">;
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
