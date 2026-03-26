import { describe, expect, it } from "vitest";

import { checkBucketAccess, filterVisibleEntities } from "../../lib/bucket-access.js";

import type { BucketAccessCheck, BucketId } from "@pluralscape/types";

const bkt = (id: string): BucketId => id as BucketId;

describe("checkBucketAccess", () => {
  it("returns false when friendBucketIds is empty", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [],
      contentBucketIds: [bkt("bkt_a")],
    };
    expect(checkBucketAccess(check)).toBe(false);
  });

  it("returns false when contentBucketIds is empty", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [bkt("bkt_a")],
      contentBucketIds: [],
    };
    expect(checkBucketAccess(check)).toBe(false);
  });

  it("returns false when both sets are empty", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [],
      contentBucketIds: [],
    };
    expect(checkBucketAccess(check)).toBe(false);
  });

  it("returns false when sets have no intersection", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [bkt("bkt_a"), bkt("bkt_b")],
      contentBucketIds: [bkt("bkt_c"), bkt("bkt_d")],
    };
    expect(checkBucketAccess(check)).toBe(false);
  });

  it("returns true when sets have single intersection", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [bkt("bkt_a"), bkt("bkt_b")],
      contentBucketIds: [bkt("bkt_b"), bkt("bkt_c")],
    };
    expect(checkBucketAccess(check)).toBe(true);
  });

  it("returns true when sets have multiple intersections", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [bkt("bkt_a"), bkt("bkt_b"), bkt("bkt_c")],
      contentBucketIds: [bkt("bkt_b"), bkt("bkt_c")],
    };
    expect(checkBucketAccess(check)).toBe(true);
  });

  it("returns true with single-element matching sets", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [bkt("bkt_a")],
      contentBucketIds: [bkt("bkt_a")],
    };
    expect(checkBucketAccess(check)).toBe(true);
  });

  it("returns true with identical multi-element sets", () => {
    const check: BucketAccessCheck = {
      friendBucketIds: [bkt("bkt_a"), bkt("bkt_b")],
      contentBucketIds: [bkt("bkt_a"), bkt("bkt_b")],
    };
    expect(checkBucketAccess(check)).toBe(true);
  });
});

describe("filterVisibleEntities", () => {
  interface TestEntity {
    readonly id: string;
    readonly name: string;
  }

  const getId = (e: TestEntity): string => e.id;

  it("returns empty array when friendBucketIds is empty", () => {
    const entities: TestEntity[] = [{ id: "e1", name: "Entity 1" }];
    const bucketMap = new Map([["e1", [bkt("bkt_a")]]]);

    const result = filterVisibleEntities(entities, [], bucketMap, getId);
    expect(result).toEqual([]);
  });

  it("returns empty array when no entities have bucket tags", () => {
    const entities: TestEntity[] = [{ id: "e1", name: "Entity 1" }];
    const bucketMap = new Map<string, BucketId[]>();

    const result = filterVisibleEntities(entities, [bkt("bkt_a")], bucketMap, getId);
    expect(result).toEqual([]);
  });

  it("returns empty array when entity has empty bucket tags", () => {
    const entities: TestEntity[] = [{ id: "e1", name: "Entity 1" }];
    const bucketMap = new Map<string, BucketId[]>([["e1", []]]);

    const result = filterVisibleEntities(entities, [bkt("bkt_a")], bucketMap, getId);
    expect(result).toEqual([]);
  });

  it("filters to only visible entities", () => {
    const entities: TestEntity[] = [
      { id: "e1", name: "Visible" },
      { id: "e2", name: "Hidden" },
      { id: "e3", name: "Also visible" },
    ];
    const bucketMap = new Map([
      ["e1", [bkt("bkt_a")]],
      ["e2", [bkt("bkt_c")]],
      ["e3", [bkt("bkt_b")]],
    ]);

    const result = filterVisibleEntities(entities, [bkt("bkt_a"), bkt("bkt_b")], bucketMap, getId);
    expect(result).toEqual([
      { id: "e1", name: "Visible" },
      { id: "e3", name: "Also visible" },
    ]);
  });

  it("excludes entities without any bucket map entry", () => {
    const entities: TestEntity[] = [
      { id: "e1", name: "Tagged" },
      { id: "e2", name: "Untagged" },
    ];
    const bucketMap = new Map([["e1", [bkt("bkt_a")]]]);

    const result = filterVisibleEntities(entities, [bkt("bkt_a")], bucketMap, getId);
    expect(result).toEqual([{ id: "e1", name: "Tagged" }]);
  });

  it("returns all entities when all have matching buckets", () => {
    const entities: TestEntity[] = [
      { id: "e1", name: "One" },
      { id: "e2", name: "Two" },
    ];
    const bucketMap = new Map([
      ["e1", [bkt("bkt_shared")]],
      ["e2", [bkt("bkt_shared")]],
    ]);

    const result = filterVisibleEntities(entities, [bkt("bkt_shared")], bucketMap, getId);
    expect(result).toEqual(entities);
  });
});
