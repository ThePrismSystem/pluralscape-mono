// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

import type { DecryptedFriendDashboard } from "@pluralscape/data/transforms/friend-dashboard";
import type { BucketId, FriendConnectionId, SystemId } from "@pluralscape/types";

type CapturedOpts = Record<string, unknown>;
let lastQueryOpts: CapturedOpts = {};
let lastQueryInput: Record<string, unknown> = {};

const MOCK_BUCKET_ID = brandId<BucketId>("bkt_test");

const mockDecrypted: DecryptedFriendDashboard = {
  systemId: brandId<SystemId>("sys_friend"),
  memberCount: 2,
  activeFronting: { sessions: [], isCofronting: false },
  visibleMembers: [],
  visibleCustomFronts: [],
  visibleStructureEntities: [],
};

let mockBucketKeys: Map<BucketId, { key: Uint8Array; keyVersion: number }> | null = new Map([
  [MOCK_BUCKET_ID, { key: new Uint8Array(32), keyVersion: 1 }],
]);

vi.mock("../../providers/bucket-key-provider.js", () => ({
  useBucketKeys: () => mockBucketKeys,
}));

const mockDecryptFriendDashboard = vi.fn().mockReturnValue(mockDecrypted);

vi.mock("@pluralscape/data/transforms/friend-dashboard", () => ({
  decryptFriendDashboard: (...args: unknown[]): DecryptedFriendDashboard =>
    mockDecryptFriendDashboard(...args) as DecryptedFriendDashboard,
}));

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    friend: {
      getDashboard: {
        useQuery: (input: Record<string, unknown>, opts: CapturedOpts = {}) => {
          lastQueryInput = input;
          lastQueryOpts = opts;
          return { data: undefined, isLoading: true };
        },
      },
    },
  },
}));

const { useFriendDashboard } = await import("../use-friend-dashboard.js");

beforeEach(() => {
  lastQueryOpts = {};
  lastQueryInput = {};
  mockBucketKeys = new Map([[MOCK_BUCKET_ID, { key: new Uint8Array(32), keyVersion: 1 }]]);
  vi.clearAllMocks();
});

describe("useFriendDashboard", () => {
  it("passes connectionId to query input", () => {
    renderHookWithProviders(() => useFriendDashboard(brandId<FriendConnectionId>("fc_abc")));
    expect(lastQueryInput["connectionId"]).toBe("fc_abc");
  });

  it("is enabled when bucket keys are available", () => {
    renderHookWithProviders(() => useFriendDashboard(brandId<FriendConnectionId>("fc_abc")));
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("is disabled when bucket keys are null (loading)", () => {
    mockBucketKeys = null;
    renderHookWithProviders(() => useFriendDashboard(brandId<FriendConnectionId>("fc_abc")));
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("is disabled when bucket keys map is empty", () => {
    mockBucketKeys = new Map();
    renderHookWithProviders(() => useFriendDashboard(brandId<FriendConnectionId>("fc_abc")));
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("provides a select callback", () => {
    renderHookWithProviders(() => useFriendDashboard(brandId<FriendConnectionId>("fc_abc")));
    expect(lastQueryOpts["select"]).toBeTypeOf("function");
  });

  it("select callback calls decryptFriendDashboard with resolver", () => {
    renderHookWithProviders(() => useFriendDashboard(brandId<FriendConnectionId>("fc_abc")));
    const selectFn = lastQueryOpts["select"] as (raw: unknown) => DecryptedFriendDashboard;
    const rawData = { fake: "data" };
    const result = selectFn(rawData);

    expect(mockDecryptFriendDashboard).toHaveBeenCalledTimes(1);
    expect(mockDecryptFriendDashboard).toHaveBeenCalledWith(rawData, expect.any(Function));
    expect(result).toBe(mockDecrypted);
  });
});
