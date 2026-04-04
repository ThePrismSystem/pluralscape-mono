import { describe, expect, it } from "vitest";

import { narrowNotificationConfig, narrowNotificationConfigPage } from "../notification-config.js";

import type { NotificationConfigRaw } from "../notification-config.js";
import type {
  NotificationConfigId,
  NotificationEventType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

const NOW = 1_700_000_000_000 as UnixMillis;
const LATER = 1_700_002_000_000 as UnixMillis;

function makeRaw(overrides?: Partial<NotificationConfigRaw>): NotificationConfigRaw {
  return {
    id: "nc_test0001" as NotificationConfigId,
    systemId: "sys_test001" as SystemId,
    eventType: "switch-reminder" as NotificationEventType,
    enabled: true,
    pushEnabled: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("narrowNotificationConfig", () => {
  it("returns live entity with archived: false", () => {
    const result = narrowNotificationConfig(makeRaw());
    expect(result.archived).toBe(false);
    expect(result.id).toBe("nc_test0001");
    expect(result.systemId).toBe("sys_test001");
    expect(result.eventType).toBe("switch-reminder");
    expect(result.enabled).toBe(true);
    expect(result.pushEnabled).toBe(false);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it("returns archived entity with archivedAt", () => {
    const result = narrowNotificationConfig(makeRaw({ archived: true, archivedAt: LATER }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(LATER);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    expect(() => narrowNotificationConfig(makeRaw({ archived: true, archivedAt: null }))).toThrow(
      "missing archivedAt",
    );
  });

  it("handles pushEnabled: true", () => {
    const result = narrowNotificationConfig(makeRaw({ pushEnabled: true }));
    expect(result.pushEnabled).toBe(true);
  });

  it("handles enabled: false", () => {
    const result = narrowNotificationConfig(makeRaw({ enabled: false }));
    expect(result.enabled).toBe(false);
  });
});

describe("narrowNotificationConfigPage", () => {
  it("narrows all items and preserves cursor", () => {
    const page = { data: [makeRaw(), makeRaw()], nextCursor: "cursor_abc" };
    const result = narrowNotificationConfigPage(page);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = narrowNotificationConfigPage({ data: [], nextCursor: null });
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});
