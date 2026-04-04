// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

// ── Capture subscription calls ───────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastSubscriptionOpts: CapturedOpts = {};

const mockUtils = {
  boardMessage: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    boardMessage: {
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

const { useBoardMessageSubscription } = await import("../use-board-message-subscription.js");

// ── Tests ────────────────────────────────────────────────────────────
describe("useBoardMessageSubscription", () => {
  it("enabled defaults to true", () => {
    useBoardMessageSubscription();
    expect(lastSubscriptionOpts["enabled"]).toBe(true);
  });

  it("respects enabled: false", () => {
    useBoardMessageSubscription({ enabled: false });
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });

  it("onError handler is present", () => {
    useBoardMessageSubscription();
    expect(lastSubscriptionOpts["onError"]).toBeDefined();
    expect(typeof lastSubscriptionOpts["onError"]).toBe("function");
  });

  it("onData with boardMessageId invalidates get and list", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    useBoardMessageSubscription();
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({ boardMessageId: "bm-1" });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-1",
    });
  });

  it("onData without boardMessageId invalidates only list", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    useBoardMessageSubscription();
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({});
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.boardMessage.get.invalidate).not.toHaveBeenCalled();
  });
});
