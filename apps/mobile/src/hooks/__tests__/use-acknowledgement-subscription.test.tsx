// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

// ── Capture subscription calls ───────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastSubscriptionOpts: CapturedOpts = {};

const mockUtils = {
  acknowledgement: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    acknowledgement: {
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

const { useAcknowledgementSubscription } = await import("../use-acknowledgement-subscription.js");

// ── Tests ────────────────────────────────────────────────────────────
describe("useAcknowledgementSubscription", () => {
  it("enabled defaults to true", () => {
    useAcknowledgementSubscription();
    expect(lastSubscriptionOpts["enabled"]).toBe(true);
  });

  it("respects enabled: false", () => {
    useAcknowledgementSubscription({ enabled: false });
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });

  it("onError handler is present", () => {
    useAcknowledgementSubscription();
    expect(lastSubscriptionOpts["onError"]).toBeDefined();
    expect(typeof lastSubscriptionOpts["onError"]).toBe("function");
  });

  it("onData with ackId invalidates get and list", () => {
    mockUtils.acknowledgement.get.invalidate.mockClear();
    mockUtils.acknowledgement.list.invalidate.mockClear();
    useAcknowledgementSubscription();
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({ ackId: "ack-1" });
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      ackId: "ack-1",
    });
  });

  it("onData without ackId invalidates only list", () => {
    mockUtils.acknowledgement.get.invalidate.mockClear();
    mockUtils.acknowledgement.list.invalidate.mockClear();
    useAcknowledgementSubscription();
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({});
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.acknowledgement.get.invalidate).not.toHaveBeenCalled();
  });
});
