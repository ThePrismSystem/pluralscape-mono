import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { PushPayload, PushProvider } from "../../services/push-notification-worker.js";
import type { AccountId, DeviceTokenId, DeviceTokenPlatform, SystemId } from "@pluralscape/types";
import type { Mock } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/db/pg", () => ({
  deviceTokens: {
    id: "id",
    accountId: "account_id",
    systemId: "system_id",
    platform: "platform",
    tokenHash: "token_hash",
    createdAt: "created_at",
    lastActiveAt: "last_active_at",
    revokedAt: "revoked_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    now: vi.fn().mockReturnValue(2000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

const { loggerInfoMock, loggerWarnMock } = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));
vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { processPushNotification, StubPushProvider } =
  await import("../../services/push-notification-worker.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const DEVICE_TOKEN_ID = brandId<DeviceTokenId>("dt_test-token");
const ACCOUNT_ID = brandId<AccountId>("acct_test");
const SYSTEM_ID = brandId<SystemId>("sys_test");
const PLATFORM: DeviceTokenPlatform = "ios";

const MOCK_PAYLOAD: PushPayload = {
  title: "Test Notification",
  body: "Test body",
  data: null,
};

function makeJobPayload(overrides: Record<string, unknown> = {}): {
  accountId: AccountId;
  systemId: SystemId;
  deviceTokenId: DeviceTokenId;
  platform: DeviceTokenPlatform;
  payload: PushPayload;
} {
  return {
    accountId: ACCOUNT_ID,
    systemId: SYSTEM_ID,
    deviceTokenId: DEVICE_TOKEN_ID,
    platform: PLATFORM,
    payload: MOCK_PAYLOAD,
    ...overrides,
  };
}

function makeMockProvider(): { provider: PushProvider; send: Mock<PushProvider["send"]> } {
  const send = vi.fn<PushProvider["send"]>().mockResolvedValue(undefined);
  return { provider: { send }, send };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("push-notification-worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── StubPushProvider ──────────────────────────────────────────────

  describe("StubPushProvider", () => {
    it("logs notification with device token ID and resolves", async () => {
      const stub = new StubPushProvider();

      await stub.send(DEVICE_TOKEN_ID, PLATFORM, MOCK_PAYLOAD);

      expect(loggerInfoMock).toHaveBeenCalledWith(
        "[push-worker] stub delivery",
        expect.objectContaining({
          platform: PLATFORM,
          title: MOCK_PAYLOAD.title,
          deviceTokenId: DEVICE_TOKEN_ID,
        }),
      );
    });
  });

  // ── processPushNotification ───────────────────────────────────────

  describe("processPushNotification", () => {
    it("delivers notification and updates lastActiveAt", async () => {
      const { db, chain } = mockDb();
      const { provider, send } = makeMockProvider();
      chain.limit.mockResolvedValueOnce([{ id: DEVICE_TOKEN_ID, revokedAt: null }]);

      await processPushNotification(db, makeJobPayload(), provider);

      expect(send).toHaveBeenCalledWith(DEVICE_TOKEN_ID, PLATFORM, MOCK_PAYLOAD);
      // Should update lastActiveAt
      expect(chain.set).toHaveBeenCalled();
    });

    it("skips delivery when device token not found", async () => {
      const { db, chain } = mockDb();
      const { provider, send } = makeMockProvider();
      chain.limit.mockResolvedValueOnce([]);

      await processPushNotification(db, makeJobPayload(), provider);

      expect(send).not.toHaveBeenCalled();
      expect(loggerWarnMock).toHaveBeenCalledWith(
        "[push-worker] device token not found, skipping",
        expect.objectContaining({ deviceTokenId: DEVICE_TOKEN_ID }),
      );
    });

    it("skips delivery when device token is revoked", async () => {
      const { db, chain } = mockDb();
      const { provider, send } = makeMockProvider();
      chain.limit.mockResolvedValueOnce([{ id: DEVICE_TOKEN_ID, revokedAt: 500 }]);

      await processPushNotification(db, makeJobPayload(), provider);

      expect(send).not.toHaveBeenCalled();
      expect(loggerWarnMock).toHaveBeenCalledWith(
        "[push-worker] device token revoked, skipping",
        expect.objectContaining({ deviceTokenId: DEVICE_TOKEN_ID }),
      );
    });

    it("propagates provider errors for queue retry", async () => {
      const { db, chain } = mockDb();
      const { provider, send } = makeMockProvider();
      const providerError = new Error("APNS delivery failed");
      send.mockRejectedValueOnce(providerError);
      chain.limit.mockResolvedValueOnce([{ id: DEVICE_TOKEN_ID, revokedAt: null }]);

      await expect(processPushNotification(db, makeJobPayload(), provider)).rejects.toThrow(
        "APNS delivery failed",
      );
    });

    it("uses default StubPushProvider when none injected", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: DEVICE_TOKEN_ID, revokedAt: null }]);

      // Should not throw — uses default stub provider
      await processPushNotification(db, makeJobPayload());

      expect(loggerInfoMock).toHaveBeenCalledWith(
        "[push-worker] stub delivery",
        expect.any(Object),
      );
    });
  });
});
