import { describe, expect, expectTypeOf, it } from "vitest";

import { FRIEND_EXPORT_ENTITY_TYPES, isFriendExportEntityType } from "../friend-export.js";

import type { FriendDashboardKeyGrant } from "../friend-dashboard.js";
import type {
  FriendExportEntity,
  FriendExportEntityType,
  FriendExportManifestEntry,
  FriendExportManifestResponse,
  FriendExportPageResponse,
} from "../friend-export.js";
import type { SystemId } from "../ids.js";
import type { PaginationCursor } from "../pagination.js";
import type { BucketContentEntityType } from "../privacy.js";
import type { UnixMillis } from "../timestamps.js";

describe("FriendExportEntityType", () => {
  it("is equivalent to BucketContentEntityType", () => {
    expectTypeOf<FriendExportEntityType>().toEqualTypeOf<BucketContentEntityType>();
  });
});

describe("FRIEND_EXPORT_ENTITY_TYPES", () => {
  it("contains all 21 entity types", () => {
    expect(FRIEND_EXPORT_ENTITY_TYPES).toHaveLength(21);
  });

  it("contains known entity types", () => {
    expect(FRIEND_EXPORT_ENTITY_TYPES).toContain("member");
    expect(FRIEND_EXPORT_ENTITY_TYPES).toContain("group");
    expect(FRIEND_EXPORT_ENTITY_TYPES).toContain("fronting-session");
    expect(FRIEND_EXPORT_ENTITY_TYPES).toContain("innerworld-entity");
  });
});

describe("isFriendExportEntityType", () => {
  it("returns true for valid entity types", () => {
    expect(isFriendExportEntityType("member")).toBe(true);
    expect(isFriendExportEntityType("custom-front")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isFriendExportEntityType("invalid")).toBe(false);
    expect(isFriendExportEntityType("")).toBe(false);
  });
});

describe("FriendExportEntity", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendExportEntity["id"]>().toBeString();
    expectTypeOf<FriendExportEntity["entityType"]>().toEqualTypeOf<FriendExportEntityType>();
    expectTypeOf<FriendExportEntity["encryptedData"]>().toBeString();
    expectTypeOf<FriendExportEntity["updatedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendExportEntity>().toEqualTypeOf<
      "id" | "entityType" | "encryptedData" | "updatedAt"
    >();
  });
});

describe("FriendExportPageResponse", () => {
  it("has PaginatedResult fields", () => {
    expectTypeOf<FriendExportPageResponse["items"]>().toEqualTypeOf<
      readonly FriendExportEntity[]
    >();
    expectTypeOf<FriendExportPageResponse["nextCursor"]>().toEqualTypeOf<PaginationCursor | null>();
    expectTypeOf<FriendExportPageResponse["hasMore"]>().toEqualTypeOf<boolean>();
    expectTypeOf<FriendExportPageResponse["totalCount"]>().toEqualTypeOf<number | null>();
  });

  it("has etag field", () => {
    expectTypeOf<FriendExportPageResponse["etag"]>().toBeString();
  });
});

describe("FriendExportManifestEntry", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendExportManifestEntry["entityType"]>().toEqualTypeOf<FriendExportEntityType>();
    expectTypeOf<FriendExportManifestEntry["count"]>().toBeNumber();
    expectTypeOf<FriendExportManifestEntry["lastUpdatedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendExportManifestEntry>().toEqualTypeOf<
      "entityType" | "count" | "lastUpdatedAt"
    >();
  });
});

describe("FriendExportManifestResponse", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendExportManifestResponse["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FriendExportManifestResponse["entries"]>().toEqualTypeOf<
      readonly FriendExportManifestEntry[]
    >();
    expectTypeOf<FriendExportManifestResponse["keyGrants"]>().toEqualTypeOf<
      readonly FriendDashboardKeyGrant[]
    >();
    expectTypeOf<FriendExportManifestResponse["etag"]>().toBeString();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendExportManifestResponse>().toEqualTypeOf<
      "systemId" | "entries" | "keyGrants" | "etag"
    >();
  });
});
