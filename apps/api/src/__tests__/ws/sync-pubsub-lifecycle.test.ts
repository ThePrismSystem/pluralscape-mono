import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("hono/bun", () => ({
  getConnInfo: vi.fn(() => ({ remote: { address: "127.0.0.1" } })),
}));
vi.mock("../../ws/bun-adapter.js", () => ({
  upgradeWebSocket: vi.fn(() => vi.fn()),
  websocket: {},
}));
vi.mock("../../middleware/access-log.js", () => ({
  accessLogMiddleware: () => vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));
vi.mock("../../middleware/request-id.js", () => ({
  requestIdMiddleware: () => vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}));

// ── Import under test ────────────────────────────────────────────

const { getSyncPubSub, setSyncPubSub } = await import("../../ws/index.js");

// ── Tests ────────────────────────────────────────────────────────

describe("setSyncPubSub lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getSyncPubSub returns null initially", () => {
    expect(getSyncPubSub()).toBeNull();
  });

  it("returns the instance after setSyncPubSub", () => {
    const mockPubSub = {
      id: "test-server",
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
    };

    // Widen via `unknown` so the cast to ValkeyPubSub is a single `as` step —
    // the test only inspects identity, not behaviour.
    const opaque: unknown = mockPubSub;
    setSyncPubSub(opaque as Parameters<typeof setSyncPubSub>[0]);

    expect(getSyncPubSub()).toBe(mockPubSub);
  });
});
