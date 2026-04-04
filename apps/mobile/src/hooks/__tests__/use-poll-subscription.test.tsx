// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { PollId } from "@pluralscape/types";

// ── Capture subscription calls ───────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastSubscriptionOpts: CapturedOpts = {};

const mockUtils = {
  poll: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
    results: { invalidate: vi.fn() },
    listVotes: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    poll: {
      onChange: {
        useSubscription: (_input: unknown, opts: CapturedOpts) => {
          lastSubscriptionOpts = opts;
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

const { usePollSubscription } = await import("../use-poll-subscription.js");

// ── Tests ────────────────────────────────────────────────────────────
describe("usePollSubscription", () => {
  it("enabled defaults to true", () => {
    usePollSubscription();
    expect(lastSubscriptionOpts["enabled"]).toBe(true);
  });

  it("respects enabled: false", () => {
    usePollSubscription("poll-1" as PollId, { enabled: false });
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });

  it("onError handler is present", () => {
    usePollSubscription();
    expect(lastSubscriptionOpts["onError"]).toBeDefined();
    expect(typeof lastSubscriptionOpts["onError"]).toBe("function");
  });

  it("onData with pollId invalidates get, list, results, and listVotes", () => {
    mockUtils.poll.get.invalidate.mockClear();
    mockUtils.poll.list.invalidate.mockClear();
    mockUtils.poll.results.invalidate.mockClear();
    mockUtils.poll.listVotes.invalidate.mockClear();
    usePollSubscription();
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({ pollId: "poll-1" });
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
    expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
    expect(mockUtils.poll.listVotes.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
  });

  it("onData without pollId invalidates only list", () => {
    mockUtils.poll.get.invalidate.mockClear();
    mockUtils.poll.list.invalidate.mockClear();
    mockUtils.poll.results.invalidate.mockClear();
    mockUtils.poll.listVotes.invalidate.mockClear();
    usePollSubscription();
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({});
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.poll.get.invalidate).not.toHaveBeenCalled();
    expect(mockUtils.poll.results.invalidate).not.toHaveBeenCalled();
    expect(mockUtils.poll.listVotes.invalidate).not.toHaveBeenCalled();
  });
});
