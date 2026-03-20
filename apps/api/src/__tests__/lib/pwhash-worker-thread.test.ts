import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock parentPort ────────────────────────────────────────────────────
const mockPostMessage = vi.fn();
const messageHandlers: ((msg: unknown) => void)[] = [];

vi.mock("node:worker_threads", () => ({
  parentPort: {
    on: vi.fn().mockImplementation((event: string, handler: (msg: unknown) => void) => {
      if (event === "message") messageHandlers.push(handler);
    }),
    postMessage: mockPostMessage,
  },
}));

// ── Mock @pluralscape/crypto ───────────────────────────────────────────
const mockHashPin = vi.fn().mockReturnValue("hashed-value");
const mockVerifyPin = vi.fn().mockReturnValue(true);
const mockDeriveTransferKey = vi.fn().mockReturnValue(new Uint8Array(32));
const mockAssertPwhashSalt = vi.fn();

vi.mock("@pluralscape/crypto", () => ({
  initSodium: vi.fn().mockResolvedValue(undefined),
  hashPin: mockHashPin,
  verifyPin: mockVerifyPin,
  deriveTransferKey: mockDeriveTransferKey,
  assertPwhashSalt: mockAssertPwhashSalt,
}));

// Dynamic import triggers main() which calls initSodium() and registers
// the message handler on parentPort.
await import("../../lib/pwhash-worker-thread.js");

// ── Helpers ────────────────────────────────────────────────────────────
/** Get the message handler registered by the worker. */
function getMessageHandler(): (msg: unknown) => void {
  const handler = messageHandlers[0];
  if (!handler) throw new Error("No message handler registered on parentPort");
  return handler;
}

// ── Cleanup ────────────────────────────────────────────────────────────
beforeEach(() => {
  mockPostMessage.mockClear();
  mockHashPin.mockClear();
  mockVerifyPin.mockClear();
  mockDeriveTransferKey.mockClear();
  mockAssertPwhashSalt.mockClear();
  mockHashPin.mockReturnValue("hashed-value");
  mockVerifyPin.mockReturnValue(true);
  mockDeriveTransferKey.mockReturnValue(new Uint8Array(32));
  mockAssertPwhashSalt.mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────
describe("pwhash-worker-thread", () => {
  describe("hash operation", () => {
    it("calls hashPin and posts back the result", () => {
      const handler = getMessageHandler();
      handler({ id: 1, op: "hash", pin: "1234", profile: "server" });

      expect(mockHashPin).toHaveBeenCalledWith("1234", "server");
      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 1,
        ok: true,
        value: "hashed-value",
      });
    });
  });

  describe("verify operation", () => {
    it("calls verifyPin and posts back the boolean result", () => {
      const handler = getMessageHandler();
      handler({ id: 2, op: "verify", hash: "stored-hash", pin: "1234" });

      expect(mockVerifyPin).toHaveBeenCalledWith("stored-hash", "1234");
      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 2,
        ok: true,
        value: true,
      });
    });

    it("returns false when verification fails", () => {
      mockVerifyPin.mockReturnValue(false);

      const handler = getMessageHandler();
      handler({ id: 3, op: "verify", hash: "stored-hash", pin: "wrong" });

      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 3,
        ok: true,
        value: false,
      });
    });
  });

  describe("deriveTransferKey operation", () => {
    it("calls deriveTransferKey and posts back the result", () => {
      const salt = new Uint8Array(16);
      const handler = getMessageHandler();
      handler({ id: 10, op: "deriveTransferKey", code: "12345678", salt });

      expect(mockAssertPwhashSalt).toHaveBeenCalledWith(salt);
      expect(mockDeriveTransferKey).toHaveBeenCalledWith("12345678", salt);
      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 10,
        ok: true,
        value: new Uint8Array(32),
      });
    });

    it("posts back ok=false when assertPwhashSalt throws", () => {
      mockAssertPwhashSalt.mockImplementation(() => {
        throw new Error("Invalid salt length");
      });

      const handler = getMessageHandler();
      handler({ id: 11, op: "deriveTransferKey", code: "12345678", salt: new Uint8Array(8) });

      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 11,
        ok: false,
        error: "Invalid salt length",
      });
    });
  });

  describe("error handling", () => {
    it("posts back ok=false with the error message when hashPin throws", () => {
      mockHashPin.mockImplementation(() => {
        throw new Error("Argon2id failed");
      });

      const handler = getMessageHandler();
      handler({ id: 4, op: "hash", pin: "1234", profile: "server" });

      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 4,
        ok: false,
        error: "Argon2id failed",
      });
    });

    it("posts back ok=false with the error message when verifyPin throws", () => {
      mockVerifyPin.mockImplementation(() => {
        throw new Error("Verification error");
      });

      const handler = getMessageHandler();
      handler({ id: 5, op: "verify", hash: "h", pin: "p" });

      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 5,
        ok: false,
        error: "Verification error",
      });
    });

    it("uses String(error) when a non-Error value is thrown", () => {
      mockHashPin.mockImplementation(() => {
        const err: unknown = "plain string error";
        throw err;
      });

      const handler = getMessageHandler();
      handler({ id: 6, op: "hash", pin: "1234", profile: "server" });

      expect(mockPostMessage).toHaveBeenCalledWith({
        id: 6,
        ok: false,
        error: "plain string error",
      });
    });
  });
});
