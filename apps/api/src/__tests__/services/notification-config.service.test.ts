import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { NotificationConfigId, NotificationEventType, SystemId } from "@pluralscape/types";

// ── Mock tx ──────────────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

function wireChain(): void {
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  mockTx.limit.mockResolvedValue([]);
  mockTx.insert.mockReturnValue(mockTx);
  mockTx.values.mockReturnValue(mockTx);
  mockTx.returning.mockResolvedValue([]);
  mockTx.update.mockReturnValue(mockTx);
  mockTx.set.mockReturnValue(mockTx);
}

// ── Mocks ────────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withTenantTransaction: vi.fn(
    (_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
  withTenantRead: vi.fn((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockTx),
  ),
}));

vi.mock("../../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn(() => ({ systemId: SYSTEM_ID, accountId: "acct_test" })),
}));

vi.mock("@pluralscape/db/pg", () => ({
  notificationConfigs: {
    id: "id",
    systemId: "system_id",
    eventType: "event_type",
    enabled: "enabled",
    pushEnabled: "push_enabled",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("ncfg_test-id"),
    now: vi.fn().mockReturnValue(1000),
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

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

const { getOrCreateNotificationConfig, updateNotificationConfig, listNotificationConfigs } =
  await import("../../services/notification-config.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const CONFIG_ID = brandId<NotificationConfigId>("ncfg_test-config");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);
const EVENT_TYPE: NotificationEventType = "switch-reminder";

function makeConfigRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CONFIG_ID,
    systemId: SYSTEM_ID,
    eventType: EVENT_TYPE,
    // Default to fail-closed to mirror DB defaults (see VALUES.md).
    enabled: false,
    pushEnabled: false,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("notification-config service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
    wireChain();
  });

  wireChain();

  // ── getOrCreateNotificationConfig ─────────────────────────────────

  describe("getOrCreateNotificationConfig", () => {
    it("returns existing config when found", async () => {
      mockTx.limit.mockResolvedValueOnce([makeConfigRow({ enabled: true })]);

      const result = await getOrCreateNotificationConfig({} as never, SYSTEM_ID, EVENT_TYPE, AUTH);

      expect(result.id).toBe(CONFIG_ID);
      expect(result.eventType).toBe(EVENT_TYPE);
      expect(result.enabled).toBe(true);
    });

    it("auto-creates a config row with fail-closed defaults (enabled: false, pushEnabled: false)", async () => {
      mockTx.limit.mockResolvedValueOnce([]); // no existing config
      mockTx.returning.mockResolvedValueOnce([makeConfigRow({ id: "ncfg_test-id" })]);

      const result = await getOrCreateNotificationConfig({} as never, SYSTEM_ID, EVENT_TYPE, AUTH);

      expect(result.id).toBe("ncfg_test-id");
      expect(result.enabled).toBe(false);
      expect(result.pushEnabled).toBe(false);
    });

    it("throws when insert returns no rows", async () => {
      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([]);

      await expect(
        getOrCreateNotificationConfig({} as never, SYSTEM_ID, EVENT_TYPE, AUTH),
      ).rejects.toThrow("Notification config insert returned no rows");
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        getOrCreateNotificationConfig({} as never, SYSTEM_ID, EVENT_TYPE, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── updateNotificationConfig ──────────────────────────────────────

  describe("updateNotificationConfig", () => {
    it("updates existing config and writes audit", async () => {
      mockTx.returning.mockResolvedValueOnce([makeConfigRow({ enabled: false })]);

      const result = await updateNotificationConfig(
        {} as never,
        SYSTEM_ID,
        EVENT_TYPE,
        { enabled: false },
        AUTH,
        mockAudit,
      );

      expect(result.enabled).toBe(false);
      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "notification-config.updated" }),
      );
    });

    it("creates config with overrides when no existing config found", async () => {
      mockTx.returning
        .mockResolvedValueOnce([]) // update returns nothing
        .mockResolvedValueOnce([makeConfigRow({ enabled: false, pushEnabled: false })]); // insert

      const result = await updateNotificationConfig(
        {} as never,
        SYSTEM_ID,
        EVENT_TYPE,
        { enabled: false, pushEnabled: false },
        AUTH,
        mockAudit,
      );

      expect(result.enabled).toBe(false);
      expect(result.pushEnabled).toBe(false);
      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          detail: expect.stringContaining("created and updated"),
        }),
      );
    });

    it("updates only enabled when pushEnabled not provided", async () => {
      mockTx.returning.mockResolvedValueOnce([makeConfigRow({ enabled: false })]);

      const result = await updateNotificationConfig(
        {} as never,
        SYSTEM_ID,
        EVENT_TYPE,
        { enabled: false },
        AUTH,
        mockAudit,
      );

      expect(result.enabled).toBe(false);
    });

    it("updates only pushEnabled when enabled not provided", async () => {
      mockTx.returning.mockResolvedValueOnce([makeConfigRow({ pushEnabled: false })]);

      const result = await updateNotificationConfig(
        {} as never,
        SYSTEM_ID,
        EVENT_TYPE,
        { pushEnabled: false },
        AUTH,
        mockAudit,
      );

      expect(result.pushEnabled).toBe(false);
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        updateNotificationConfig(
          {} as never,
          SYSTEM_ID,
          EVENT_TYPE,
          { enabled: false },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── listNotificationConfigs ───────────────────────────────────────

  describe("listNotificationConfigs", () => {
    it("returns list of configs", async () => {
      mockTx.limit.mockResolvedValueOnce([
        makeConfigRow(),
        makeConfigRow({ id: "ncfg_other", eventType: "timer_alert" }),
      ]);

      const result = await listNotificationConfigs({} as never, SYSTEM_ID, AUTH);

      expect(result).toHaveLength(2);
      expect(result[0]?.eventType).toBe(EVENT_TYPE);
    });

    it("returns empty list when no configs", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      const result = await listNotificationConfigs({} as never, SYSTEM_ID, AUTH);
      expect(result).toHaveLength(0);
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listNotificationConfigs({} as never, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });
  });
});
